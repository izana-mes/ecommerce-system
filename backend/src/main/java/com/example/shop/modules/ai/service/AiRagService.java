package com.example.shop.modules.ai.service;

import com.example.shop.modules.coupon.entity.Coupon;
import com.example.shop.modules.coupon.repository.CouponRepository;
import com.example.shop.modules.order.dto.OrderHistoryItemDto;
import com.example.shop.modules.order.service.OrderService;
import com.example.shop.modules.product.dto.ProductDto;
import com.example.shop.modules.product.service.ProductService;
import com.example.shop.modules.review.dto.ProductReviewSummaryDto;
import com.example.shop.modules.review.service.ProductReviewService;
import com.example.shop.modules.user.entity.User;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

/**
 * High-precision Retrieval-Augmented Generation (RAG) Service for the ecommerce store.
 * Performs deterministic database queries to extract verified facts (products, categories,
 * prices, inventory, reviews, promotions, and authenticated orders) before AI generation.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class AiRagService {

    private final ProductService productService;
    private final OrderService orderService;
    private final CouponRepository couponRepository;
    private final ProductReviewService productReviewService;

    private static final Pattern ORDER_PATTERN = Pattern.compile("\\b(ORD-[A-Za-z0-9_-]+)\\b", Pattern.CASE_INSENSITIVE);
    private static final Pattern ID_PATTERN = Pattern.compile("\\b(?:product|id|item)[\\s#:]*([0-9]{1,10})\\b", Pattern.CASE_INSENSITIVE);
    private static final Pattern PRICE_QUERY_PATTERN = Pattern.compile("(?:price|cost|how much|cheapest|expensive|cheap)", Pattern.CASE_INSENSITIVE);
    private static final Pattern STOCK_QUERY_PATTERN = Pattern.compile("(?:stock|inventory|available|availability|in stock|out of stock)", Pattern.CASE_INSENSITIVE);
    private static final Pattern CATEGORY_QUERY_PATTERN = Pattern.compile("(?:category|categories|collection|collections|types of products|what do you sell)", Pattern.CASE_INSENSITIVE);
    private static final Pattern PROMO_QUERY_PATTERN = Pattern.compile("(?:discount|coupon|promo|promotion|sale|voucher|deal|offer)", Pattern.CASE_INSENSITIVE);
    private static final Pattern REVIEW_QUERY_PATTERN = Pattern.compile("(?:review|reviews|rating|ratings|feedback|what do customers say)", Pattern.CASE_INSENSITIVE);
    private static final Pattern ORDER_QUERY_PATTERN = Pattern.compile("(?:my order|my orders|track order|order status|tracking|package|shipment)", Pattern.CASE_INSENSITIVE);

    public record RagContext(
            String groundedContextPrompt,
            List<ProductDto> retrievedProducts,
            boolean askedAboutOrdersWithoutAuth
    ) {}

    @Transactional(readOnly = true)
    public RagContext retrieveContext(String query, User user, String requestedProductId) {
        if (query == null || query.isBlank()) {
            return new RagContext("", List.of(), false);
        }

        StringBuilder context = new StringBuilder();
        List<ProductDto> matchedProducts = new ArrayList<>();
        boolean orderWithoutAuth = false;

        // 1. Check for specific requestedProductId or ID in text
        String targetId = requestedProductId;
        if (targetId == null || targetId.isBlank()) {
            Matcher idMatcher = ID_PATTERN.matcher(query);
            if (idMatcher.find()) {
                targetId = idMatcher.group(1);
            }
        }

        if (targetId != null && !targetId.isBlank()) {
            List<ProductDto> direct = productService.searchProducts(targetId);
            for (ProductDto p : direct) {
                if (targetId.equalsIgnoreCase(p.getProductID()) && Boolean.TRUE.equals(p.getActive())) {
                    matchedProducts.add(p);
                }
            }
        }

        // 2. Keyword & semantic product matching from catalog
        // First try the raw query
        List<ProductDto> searchResults = productService.searchProducts(query);
        // If no results, strip common questions words (how much is, what is, do you have, etc.)
        if (searchResults.isEmpty()) {
            String cleaned = query.replaceAll("(?i)\\b(how much is|how much are|what is the price of|what is|price of|cost of|do you have|tell me about|is the|is there|any|the)\\b", " ")
                    .replaceAll("[^a-zA-Z0-9\\s]", " ")
                    .replaceAll("\\s+", " ")
                    .trim();
            if (!cleaned.isBlank() && !cleaned.equalsIgnoreCase(query)) {
                searchResults = productService.searchProducts(cleaned);
            }
        }
        for (ProductDto p : searchResults) {
            if (Boolean.TRUE.equals(p.getActive()) && matchedProducts.stream().noneMatch(m -> m.getProductID().equals(p.getProductID()))) {
                matchedProducts.add(p);
            }
            if (matchedProducts.size() >= 8) break;
        }

        // 3. Categories knowledge
        boolean isCategoryQuery = CATEGORY_QUERY_PATTERN.matcher(query).find();
        List<ProductDto> catalogSummary = null;
        if (matchedProducts.isEmpty() || isCategoryQuery) {
            catalogSummary = productService.getActiveProducts(50);
        }

        // Build Product Context
        if (!matchedProducts.isEmpty()) {
            context.append("### STORE PRODUCTS IN CATALOG (EXACT DATABASE MATCHES):\n");
            for (ProductDto p : matchedProducts) {
                int stock = p.getStockQuantity() != null ? p.getStockQuantity() : 0;
                context.append(String.format("- Product #%s: \"%s\" | Price: $%.2f%s | Category: %s | Stock: %d (%s) | Rating/Reviews: %s\n",
                        p.getProductID(),
                        p.getProductName(),
                        p.getProductPrice() != null ? p.getProductPrice() : 0.0,
                        (p.getOldPrice() != null && p.getOldPrice() > (p.getProductPrice() != null ? p.getProductPrice() : 0.0)) ? String.format(" (was $%.2f)", p.getOldPrice()) : "",
                        p.getCategory() != null ? p.getCategory() : "General",
                        stock,
                        stock > 0 ? "IN STOCK" : "OUT OF STOCK",
                        p.getProductReviews() != null ? p.getProductReviews() : "No reviews yet"
                ));
            }
            context.append("\n");
        }

        // 4. Categories list if asked or if catalog overview is needed
        if (isCategoryQuery || matchedProducts.isEmpty()) {
            if (catalogSummary == null) catalogSummary = productService.getActiveProducts(50);
            Set<String> categories = catalogSummary.stream()
                    .map(ProductDto::getCategory)
                    .filter(Objects::nonNull)
                    .filter(c -> !c.isBlank())
                    .collect(Collectors.toCollection(TreeSet::new));
            if (!categories.isEmpty()) {
                context.append("### STORE PRODUCT CATEGORIES AVAILABLE:\n");
                context.append(String.join(", ", categories)).append("\n\n");
            }
        }

        // 5. Product Reviews Detail if specifically asked
        if (REVIEW_QUERY_PATTERN.matcher(query).find() && !matchedProducts.isEmpty()) {
            ProductDto primaryProduct = matchedProducts.get(0);
            try {
                ProductReviewSummaryDto reviewSummary = productReviewService.getReviews(primaryProduct.getProductID(), 5, user);
                if (reviewSummary != null && reviewSummary.getReviewCount() != null && reviewSummary.getReviewCount() > 0) {
                    context.append(String.format("### REVIEWS FOR \"%s\":\n", primaryProduct.getProductName()));
                    context.append(String.format("Average Rating: %.1f/5 from %d reviews.\n",
                            reviewSummary.getAverageRating() != null ? reviewSummary.getAverageRating() : 0.0,
                            reviewSummary.getReviewCount()));
                    if (reviewSummary.getReviews() != null) {
                        for (var rev : reviewSummary.getReviews().stream().limit(3).toList()) {
                            context.append(String.format("- %s (Rating: %d/5): \"%s\"\n",
                                    rev.getAuthor() != null ? rev.getAuthor() : "Customer",
                                    rev.getRating() != null ? rev.getRating() : 5,
                                    rev.getComment() != null ? rev.getComment().trim() : ""));
                        }
                    }
                    context.append("\n");
                }
            } catch (Exception ignored) {
                // Non-critical review fetch error
            }
        }

        // 6. Promotions / Coupons if asked
        if (PROMO_QUERY_PATTERN.matcher(query).find()) {
            try {
                List<Coupon> activeCoupons = couponRepository.findByIsActiveTrue();
                if (!activeCoupons.isEmpty()) {
                    context.append("### ACTIVE STORE PROMOTIONS & COUPONS:\n");
                    for (Coupon c : activeCoupons) {
                        context.append(String.format("- Code: %s | Title: %s | Discount: %s %s | Min Order: $%.2f\n",
                                c.getCode(),
                                c.getTitle(),
                                c.getDiscountValue() != null ? c.getDiscountValue().toPlainString() : "0",
                                "percentage".equalsIgnoreCase(c.getDiscountType()) ? "% off" : "USD off",
                                c.getMinOrderAmount() != null ? c.getMinOrderAmount().doubleValue() : 0.0));
                    }
                    context.append("\n");
                } else {
                    context.append("### STORE PROMOTIONS:\nThere are currently no active public discount coupon codes.\n\n");
                }
            } catch (Exception ignored) {
            }
        }

        // 7. Orders & Security Check
        Matcher orderNumMatcher = ORDER_PATTERN.matcher(query);
        boolean hasOrderNumber = orderNumMatcher.find();
        boolean isOrderQuery = ORDER_QUERY_PATTERN.matcher(query).find() || hasOrderNumber;

        if (isOrderQuery) {
            if (user == null || user.getId() == null) {
                orderWithoutAuth = true;
                context.append("### ORDER SECURITY RESTRICTION:\n");
                context.append("The user is NOT logged in. You MUST inform them to log in to their account to view or track their order details. Never guess or display private order data to unauthenticated visitors.\n\n");
            } else {
                try {
                    List<OrderHistoryItemDto> userOrders = orderService.getMyOrders(user, 5);
                    if (userOrders == null || userOrders.isEmpty()) {
                        context.append(String.format("### USER ORDER HISTORY for %s:\nNo orders found for this account.\n\n", user.getEmail()));
                    } else {
                        context.append(String.format("### VERIFIED ORDER HISTORY for %s:\n", user.getEmail()));
                        for (OrderHistoryItemDto ord : userOrders) {
                            context.append(String.format("- Order #%s: Status: %s | Placed: %s | Total: $%.2f | Payment: %s (%s)\n",
                                    ord.getOrderNumber(),
                                    ord.getOrderStatus(),
                                    ord.getCreatedAt() != null ? ord.getCreatedAt().toString() : "Recent",
                                    ord.getTotalAmount() != null ? ord.getTotalAmount().doubleValue() : 0.0,
                                    ord.getPaymentMethod(),
                                    ord.getPaymentStatus()
                            ));
                        }
                        context.append("\n");
                    }
                } catch (Exception e) {
                    log.warn("Failed to retrieve user orders for AI RAG: {}", e.getMessage());
                }
            }
        }

        // 8. Store policies & common info
        if (query.toLowerCase().contains("return") || query.toLowerCase().contains("refund")) {
            context.append("### STORE RETURN POLICY:\n- 30-day return policy for unused items in original packaging.\n- Return requests can be submitted in the user profile/orders page.\n\n");
        }
        if (query.toLowerCase().contains("shipping") || query.toLowerCase().contains("delivery")) {
            context.append("### STORE SHIPPING POLICY:\n- Standard delivery takes 3-5 business days.\n- Real-time tracking is provided for all placed orders.\n\n");
        }
        if (query.toLowerCase().contains("payment") || query.toLowerCase().contains("cod") || query.toLowerCase().contains("momo") || query.toLowerCase().contains("paypal")) {
            context.append("### STORE PAYMENT METHODS:\n- We accept Credit/Debit Cards, PayPal, MoMo, and Cash on Delivery (COD).\n\n");
        }

        return new RagContext(context.toString().trim(), matchedProducts, orderWithoutAuth);
    }
}
