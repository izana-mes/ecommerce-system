package com.example.shop.modules.review.service;

import com.example.shop.common.exception.BusinessException;
import com.example.shop.modules.product.repository.ProductRepository;
import com.example.shop.modules.review.dto.AdminProductReviewItemDto;
import com.example.shop.modules.review.dto.AdminProductReviewPageDto;
import com.example.shop.modules.review.dto.ProductReviewDto;
import com.example.shop.modules.review.dto.ProductReviewRequest;
import com.example.shop.modules.review.dto.ProductReviewSummaryDto;
import com.example.shop.modules.user.entity.User;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.dao.DataAccessException;
import org.springframework.http.HttpStatus;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class ProductReviewServiceImpl implements ProductReviewService {

    private static final int MAX_LIMIT = 50;
    private static final int MAX_ADMIN_PAGE_SIZE = 100;

    private final StringRedisTemplate redisTemplate;
    private final ObjectMapper objectMapper;
    private final ProductRepository productRepository;

    @Value("${application.reviews.max-entries:200}")
    private int maxEntries;

    @Value("${application.reviews.ttl-days:180}")
    private long ttlDays;

    @Override
    public ProductReviewSummaryDto getReviews(String productID, int limit, Object principal) {
        String normalizedProductID = validateProductAndGetId(productID);
        int normalizedLimit = Math.max(1, Math.min(limit, MAX_LIMIT));

        List<ProductReviewDto> allReviews = readAllReviews(normalizedProductID);
        String principalIdentity = resolvePrincipalIdentity(principal);
        String principalAuthor = resolveAuthor(principal);
        List<ProductReviewDto> visibleReviews = allReviews.stream()
                .limit(normalizedLimit)
                .map(review -> sanitizeReview(review, principalIdentity, principalAuthor))
                .toList();

        double average = allReviews.isEmpty()
                ? 0.0
                : allReviews.stream().mapToInt(item -> item.getRating() == null ? 0 : item.getRating()).average().orElse(0.0);

        return ProductReviewSummaryDto.builder()
                .productID(normalizedProductID)
                .averageRating(roundTo1Decimal(average))
                .reviewCount(allReviews.size())
                .reviews(visibleReviews)
                .build();
    }

    @Override
    public ProductReviewSummaryDto addReview(String productID, ProductReviewRequest request, Object principal) {
        String normalizedProductID = validateProductAndGetId(productID);

        int rating = request == null || request.getRating() == null ? 0 : request.getRating();
        if (rating < 1 || rating > 5) {
            throw new BusinessException("rating must be between 1 and 5", HttpStatus.BAD_REQUEST);
        }

        String comment = request == null ? null : request.getComment();
        if (!StringUtils.hasText(comment)) {
            throw new BusinessException("comment is required", HttpStatus.BAD_REQUEST);
        }

        ProductReviewDto review = ProductReviewDto.builder()
                .id(UUID.randomUUID().toString())
                .rating(rating)
                .comment(comment.trim())
                .author(resolveAuthor(principal))
                .authorId(resolvePrincipalIdentity(principal))
                .createdAt(Instant.now().toString())
                .build();

        String key = buildKey(normalizedProductID);

        try {
            redisTemplate.opsForList().leftPush(key, objectMapper.writeValueAsString(review));
            redisTemplate.opsForList().trim(key, 0, Math.max(0, maxEntries - 1));
            redisTemplate.expire(key, Duration.ofDays(Math.max(1, ttlDays)));
        } catch (DataAccessException | IllegalStateException | JsonProcessingException ex) {
            throw new BusinessException("Review service is temporarily unavailable", HttpStatus.SERVICE_UNAVAILABLE);
        }

        return getReviews(normalizedProductID, 10, principal);
    }

    @Override
    public ProductReviewSummaryDto updateReview(String productID, String reviewID, ProductReviewRequest request, Object principal) {
        String normalizedProductID = validateProductAndGetId(productID);
        String normalizedReviewID = normalizeReviewID(reviewID);
        String principalIdentity = requireAuthenticatedIdentity(principal);
        String principalAuthor = resolveAuthor(principal);

        int rating = request == null || request.getRating() == null ? 0 : request.getRating();
        if (rating < 1 || rating > 5) {
            throw new BusinessException("rating must be between 1 and 5", HttpStatus.BAD_REQUEST);
        }

        String comment = request == null ? null : request.getComment();
        if (!StringUtils.hasText(comment)) {
            throw new BusinessException("comment is required", HttpStatus.BAD_REQUEST);
        }

        List<ProductReviewDto> allReviews = readAllReviews(normalizedProductID);
        ProductReviewDto target = allReviews.stream()
                .filter(review -> Objects.equals(review.getId(), normalizedReviewID))
                .findFirst()
                .orElseThrow(() -> new BusinessException("Review not found", HttpStatus.NOT_FOUND));

        if (!isOwnedByPrincipal(target, principalIdentity, principalAuthor)) {
            throw new BusinessException("You can only update your own review", HttpStatus.FORBIDDEN);
        }

        target.setRating(rating);
        target.setComment(comment.trim());

        persistAllReviews(normalizedProductID, allReviews);
        return getReviews(normalizedProductID, 10, principal);
    }

    @Override
    public ProductReviewSummaryDto deleteReview(String productID, String reviewID, Object principal) {
        String normalizedProductID = validateProductAndGetId(productID);
        String normalizedReviewID = normalizeReviewID(reviewID);
        String principalIdentity = requireAuthenticatedIdentity(principal);
        String principalAuthor = resolveAuthor(principal);

        List<ProductReviewDto> allReviews = readAllReviews(normalizedProductID);
        ProductReviewDto target = allReviews.stream()
                .filter(review -> Objects.equals(review.getId(), normalizedReviewID))
                .findFirst()
                .orElseThrow(() -> new BusinessException("Review not found", HttpStatus.NOT_FOUND));

        if (!isOwnedByPrincipal(target, principalIdentity, principalAuthor)) {
            throw new BusinessException("You can only delete your own review", HttpStatus.FORBIDDEN);
        }

        List<ProductReviewDto> remainingReviews = allReviews.stream()
                .filter(review -> !Objects.equals(review.getId(), normalizedReviewID))
                .toList();

        persistAllReviews(normalizedProductID, remainingReviews);
        return getReviews(normalizedProductID, 10, principal);
    }

    @Override
    public ProductReviewSummaryDto addDislike(String productID, String reviewID, Object principal) {
        String normalizedProductID = validateProductAndGetId(productID);
        String normalizedReviewID = normalizeReviewID(reviewID);

        List<ProductReviewDto> allReviews = readAllReviews(normalizedProductID);
        ProductReviewDto target = allReviews.stream()
                .filter(review -> Objects.equals(review.getId(), normalizedReviewID))
                .findFirst()
                .orElseThrow(() -> new BusinessException("Review not found", HttpStatus.NOT_FOUND));

        int currentDislikes = target.getDislikes() == null ? 0 : target.getDislikes();
        target.setDislikes(currentDislikes + 1);

        persistAllReviews(normalizedProductID, allReviews);
        return getReviews(normalizedProductID, 10, principal);
    }

    @Override
    public ProductReviewSummaryDto toggleLike(String productID, String reviewID, Object principal) {
        String normalizedProductID = validateProductAndGetId(productID);
        String normalizedReviewID = normalizeReviewID(reviewID);
        String principalIdentity = requireAuthenticatedIdentity(principal);

        List<ProductReviewDto> allReviews = readAllReviews(normalizedProductID);
        ProductReviewDto target = allReviews.stream()
                .filter(review -> java.util.Objects.equals(review.getId(), normalizedReviewID))
                .findFirst()
                .orElseThrow(() -> new BusinessException("Review not found", HttpStatus.NOT_FOUND));

        java.util.Set<String> likedBy = target.getLikedByUsers();
        if (likedBy == null) {
            likedBy = new java.util.HashSet<>();
        }

        if (likedBy.contains(principalIdentity)) {
            likedBy.remove(principalIdentity);
        } else {
            likedBy.add(principalIdentity);
        }

        target.setLikedByUsers(likedBy);
        target.setLikes(likedBy.size());

        persistAllReviews(normalizedProductID, allReviews);
        return getReviews(normalizedProductID, 10, principal);
    }

    @Override
    public ProductReviewSummaryDto addReply(String productID, String reviewID, com.example.shop.modules.review.dto.ProductReviewReplyDto replyDto, Object principal) {
        String normalizedProductID = validateProductAndGetId(productID);
        String normalizedReviewID = normalizeReviewID(reviewID);
        String principalAuthor = resolveAuthor(principal);
        requireAuthenticatedIdentity(principal);

        if (replyDto == null || !org.springframework.util.StringUtils.hasText(replyDto.getContent())) {
            throw new BusinessException("reply content is required", HttpStatus.BAD_REQUEST);
        }

        List<ProductReviewDto> allReviews = readAllReviews(normalizedProductID);
        ProductReviewDto target = allReviews.stream()
                .filter(review -> java.util.Objects.equals(review.getId(), normalizedReviewID))
                .findFirst()
                .orElseThrow(() -> new BusinessException("Review not found", HttpStatus.NOT_FOUND));

        List<com.example.shop.modules.review.dto.ProductReviewReplyDto> replies = target.getReplies();
        if (replies == null) {
            replies = new java.util.ArrayList<>();
        }

        replyDto.setId(java.util.UUID.randomUUID().toString());
        replyDto.setAuthor(principalAuthor);
        replyDto.setCreatedAt(java.time.Instant.now().toString());

        replies.add(replyDto);
        target.setReplies(replies);

        persistAllReviews(normalizedProductID, allReviews);
        return getReviews(normalizedProductID, 10, principal);
    }

    @Override
    public AdminProductReviewPageDto getReviewsForAdmin(String query, int page, int size) {
        int safePage = Math.max(0, page);
        int safeSize = Math.max(1, Math.min(size, MAX_ADMIN_PAGE_SIZE));
        String normalizedQuery = query == null ? "" : query.trim().toLowerCase();

        List<ReviewWithProduct> allReviews = readAllReviewsAcrossProducts();
        List<ReviewWithProduct> filtered = allReviews.stream()
                .filter(item -> matchesAdminQuery(item, normalizedQuery))
                .sorted(Comparator.comparing((ReviewWithProduct item) -> parseInstant(item.review().getCreatedAt())).reversed())
                .toList();

        int totalElements = filtered.size();
        int fromIndex = Math.min(safePage * safeSize, totalElements);
        int toIndex = Math.min(fromIndex + safeSize, totalElements);

        List<AdminProductReviewItemDto> content = filtered.subList(fromIndex, toIndex).stream()
                .map(this::toAdminReviewItem)
                .toList();

        int totalPages = totalElements == 0 ? 1 : (int) Math.ceil((double) totalElements / safeSize);

        return AdminProductReviewPageDto.builder()
                .content(content)
                .totalElements(totalElements)
                .totalPages(totalPages)
                .number(safePage)
                .size(safeSize)
                .build();
    }

    @Override
    public ProductReviewDto updateReviewAsAdmin(String productID, String reviewID, ProductReviewRequest request) {
        String normalizedProductID = validateProductAndGetId(productID);
        String normalizedReviewID = normalizeReviewID(reviewID);

        int rating = request == null || request.getRating() == null ? 0 : request.getRating();
        if (rating < 1 || rating > 5) {
            throw new BusinessException("rating must be between 1 and 5", HttpStatus.BAD_REQUEST);
        }

        String comment = request == null ? null : request.getComment();
        if (!StringUtils.hasText(comment)) {
            throw new BusinessException("comment is required", HttpStatus.BAD_REQUEST);
        }

        List<ProductReviewDto> allReviews = readAllReviews(normalizedProductID);
        ProductReviewDto target = allReviews.stream()
                .filter(review -> Objects.equals(review.getId(), normalizedReviewID))
                .findFirst()
                .orElseThrow(() -> new BusinessException("Review not found", HttpStatus.NOT_FOUND));

        target.setRating(rating);
        target.setComment(comment.trim());
        persistAllReviews(normalizedProductID, allReviews);

        return ProductReviewDto.builder()
                .id(target.getId())
                .rating(target.getRating())
                .comment(target.getComment())
                .author(target.getAuthor())
                .createdAt(target.getCreatedAt())
                .build();
    }

    @Override
    public void deleteReviewAsAdmin(String productID, String reviewID) {
        String normalizedProductID = validateProductAndGetId(productID);
        String normalizedReviewID = normalizeReviewID(reviewID);

        List<ProductReviewDto> allReviews = readAllReviews(normalizedProductID);
        boolean exists = allReviews.stream().anyMatch(review -> Objects.equals(review.getId(), normalizedReviewID));
        if (!exists) {
            throw new BusinessException("Review not found", HttpStatus.NOT_FOUND);
        }

        List<ProductReviewDto> remainingReviews = allReviews.stream()
                .filter(review -> !Objects.equals(review.getId(), normalizedReviewID))
                .toList();
        persistAllReviews(normalizedProductID, remainingReviews);
    }

    private List<ProductReviewDto> readAllReviews(String productID) {
        try {
            List<String> values = redisTemplate.opsForList().range(buildKey(productID), 0, Math.max(0, maxEntries - 1));
            if (values == null || values.isEmpty()) {
                return List.of();
            }

            List<ProductReviewDto> parsed = new ArrayList<>();
            for (String raw : values) {
                if (!StringUtils.hasText(raw)) {
                    continue;
                }
                try {
                    parsed.add(objectMapper.readValue(raw, ProductReviewDto.class));
                } catch (JsonProcessingException ignored) {
                    // Skip broken entries instead of failing the whole response.
                }
            }
            return parsed;
        } catch (DataAccessException | IllegalStateException ex) {
            return List.of();
        }
    }

    private void persistAllReviews(String productID, List<ProductReviewDto> reviews) {
        String key = buildKey(productID);
        try {
            redisTemplate.delete(key);

            if (reviews != null && !reviews.isEmpty()) {
                List<String> serialized = new ArrayList<>(reviews.size());
                for (ProductReviewDto review : reviews) {
                    serialized.add(objectMapper.writeValueAsString(review));
                }
                redisTemplate.opsForList().rightPushAll(key, serialized);
                redisTemplate.opsForList().trim(key, 0, Math.max(0, maxEntries - 1));
            }

            redisTemplate.expire(key, Duration.ofDays(Math.max(1, ttlDays)));
        } catch (DataAccessException | IllegalStateException | JsonProcessingException ex) {
            throw new BusinessException("Review service is temporarily unavailable", HttpStatus.SERVICE_UNAVAILABLE);
        }
    }

    private List<ReviewWithProduct> readAllReviewsAcrossProducts() {
        try {
            Set<String> keys = redisTemplate.keys(buildKey("*"));
            if (keys == null || keys.isEmpty()) {
                return List.of();
            }

            List<ReviewWithProduct> all = new ArrayList<>();
            for (String key : keys) {
                if (!StringUtils.hasText(key) || !key.startsWith("reviews:product:")) {
                    continue;
                }
                String productID = key.substring("reviews:product:".length());
                if (!StringUtils.hasText(productID)) {
                    continue;
                }

                List<ProductReviewDto> reviews = readAllReviews(productID);
                for (ProductReviewDto review : reviews) {
                    if (review != null && StringUtils.hasText(review.getId())) {
                        all.add(new ReviewWithProduct(productID, review));
                    }
                }
            }
            return all;
        } catch (DataAccessException | IllegalStateException ex) {
            return List.of();
        }
    }

    private boolean matchesAdminQuery(ReviewWithProduct item, String query) {
        if (!StringUtils.hasText(query)) {
            return true;
        }
        String productID = item.productID() == null ? "" : item.productID().toLowerCase();
        String author = item.review().getAuthor() == null ? "" : item.review().getAuthor().toLowerCase();
        String comment = item.review().getComment() == null ? "" : item.review().getComment().toLowerCase();
        return productID.contains(query) || author.contains(query) || comment.contains(query);
    }

    private AdminProductReviewItemDto toAdminReviewItem(ReviewWithProduct item) {
        ProductReviewDto review = item.review();
        return AdminProductReviewItemDto.builder()
                .productID(item.productID())
                .reviewID(review.getId())
                .author(review.getAuthor())
                .rating(review.getRating())
                .comment(review.getComment())
                .createdAt(review.getCreatedAt())
                .build();
    }

    private String validateProductAndGetId(String productID) {
        if (!StringUtils.hasText(productID)) {
            throw new BusinessException("productID is required", HttpStatus.BAD_REQUEST);
        }

        String normalizedProductID = productID.trim();
        productRepository.findByProductID(normalizedProductID)
                .orElseThrow(() -> new BusinessException("Product not found", HttpStatus.NOT_FOUND));

        return normalizedProductID;
    }

    private String buildKey(String productID) {
        return "reviews:product:" + productID;
    }

    private String normalizeReviewID(String reviewID) {
        if (!StringUtils.hasText(reviewID)) {
            throw new BusinessException("reviewID is required", HttpStatus.BAD_REQUEST);
        }
        return reviewID.trim();
    }

    private ProductReviewDto sanitizeReview(ProductReviewDto review, String principalIdentity, String principalAuthor) {
        if (review == null) {
            return null;
        }

        boolean currentLiked = false;
        if (review.getLikedByUsers() != null && org.springframework.util.StringUtils.hasText(principalIdentity)) {
            currentLiked = review.getLikedByUsers().contains(principalIdentity);
        }

        return ProductReviewDto.builder()
                .id(review.getId())
                .rating(review.getRating())
                .comment(review.getComment())
                .author(review.getAuthor())
                .authorId(review.getAuthorId())
                .dislikes(review.getDislikes() == null ? 0 : review.getDislikes())
                .likes(review.getLikedByUsers() == null ? 0 : review.getLikedByUsers().size())
                .likedByCurrentUser(currentLiked)
                .replies(review.getReplies() == null ? new ArrayList<>() : review.getReplies())
                .createdAt(review.getCreatedAt())
                .ownedByCurrentUser(isOwnedByPrincipal(review, principalIdentity, principalAuthor))
                .build();
    }

    private boolean isOwnedByPrincipal(ProductReviewDto review, String principalIdentity, String principalAuthor) {
        if (review == null || (!StringUtils.hasText(principalIdentity) && !StringUtils.hasText(principalAuthor))) {
            return false;
        }

        if (StringUtils.hasText(principalIdentity) && StringUtils.hasText(review.getAuthorId())) {
            return principalIdentity.equalsIgnoreCase(review.getAuthorId().trim());
        }

        if (!StringUtils.hasText(review.getAuthorId()) && StringUtils.hasText(principalAuthor) && StringUtils.hasText(review.getAuthor())) {
            return principalAuthor.equalsIgnoreCase(review.getAuthor().trim());
        }

        return false;
    }

    private String requireAuthenticatedIdentity(Object principal) {
        String principalIdentity = resolvePrincipalIdentity(principal);
        if (!StringUtils.hasText(principalIdentity)) {
            throw new BusinessException("Authentication is required", HttpStatus.UNAUTHORIZED);
        }
        return principalIdentity;
    }

    private String resolveAuthor(Object principal) {
        if (principal == null) {
            return "Guest";
        }

        if (principal instanceof User user) {
            String fullName = ((user.getFirstName() == null ? "" : user.getFirstName()) + " "
                    + (user.getLastName() == null ? "" : user.getLastName())).trim();
            if (StringUtils.hasText(fullName)) {
                return fullName;
            }
            if (StringUtils.hasText(user.getEmail())) {
                return user.getEmail();
            }
            return "User";
        }

        if (principal instanceof OAuth2User oauth2User) {
            String name = oauth2User.getAttribute("name");
            if (StringUtils.hasText(name)) {
                return name;
            }
            String email = oauth2User.getAttribute("email");
            if (StringUtils.hasText(email)) {
                return email;
            }
            if (StringUtils.hasText(oauth2User.getName())) {
                return oauth2User.getName();
            }
            return "User";
        }

        if (principal instanceof UserDetails userDetails) {
            if (StringUtils.hasText(userDetails.getUsername())) {
                return userDetails.getUsername();
            }
            return "User";
        }

        if (principal instanceof java.security.Principal authPrincipal) {
            if (StringUtils.hasText(authPrincipal.getName())) {
                return authPrincipal.getName();
            }
            return "User";
        }

        if (principal instanceof String rawPrincipal) {
            if (!"anonymousUser".equalsIgnoreCase(rawPrincipal) && StringUtils.hasText(rawPrincipal)) {
                return rawPrincipal;
            }
            return "Guest";
        }

        return "User";
    }

    private String resolvePrincipalIdentity(Object principal) {
        if (principal == null) {
            return null;
        }

        if (principal instanceof User user) {
            if (user.getId() != null) {
                return user.getId().toString();
            }
            if (StringUtils.hasText(user.getEmail())) {
                return user.getEmail().trim();
            }
            return null;
        }

        if (principal instanceof OAuth2User oauth2User) {
            String sub = oauth2User.getAttribute("sub");
            if (StringUtils.hasText(sub)) {
                return sub.trim();
            }
            String email = oauth2User.getAttribute("email");
            if (StringUtils.hasText(email)) {
                return email.trim();
            }
            if (StringUtils.hasText(oauth2User.getName())) {
                return oauth2User.getName().trim();
            }
            return null;
        }

        if (principal instanceof UserDetails userDetails) {
            if (StringUtils.hasText(userDetails.getUsername())) {
                return userDetails.getUsername().trim();
            }
            return null;
        }

        if (principal instanceof java.security.Principal authPrincipal) {
            if (StringUtils.hasText(authPrincipal.getName())) {
                return authPrincipal.getName().trim();
            }
            return null;
        }

        if (principal instanceof String rawPrincipal) {
            if (!"anonymousUser".equalsIgnoreCase(rawPrincipal) && StringUtils.hasText(rawPrincipal)) {
                return rawPrincipal.trim();
            }
            return null;
        }

        return null;
    }

    private Instant parseInstant(String raw) {
        if (!StringUtils.hasText(raw)) {
            return Instant.EPOCH;
        }
        try {
            return Instant.parse(raw.trim());
        } catch (Exception ignored) {
            return Instant.EPOCH;
        }
    }

    private record ReviewWithProduct(String productID, ProductReviewDto review) {}

    private double roundTo1Decimal(double value) {
        return Math.round(value * 10.0) / 10.0;
    }
}
