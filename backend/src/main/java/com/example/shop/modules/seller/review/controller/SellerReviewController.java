package com.example.shop.modules.seller.review.controller;

import com.example.shop.common.exception.BusinessException;
import com.example.shop.modules.product.entity.Product;
import com.example.shop.modules.product.repository.ProductRepository;
import com.example.shop.modules.review.dto.ProductReviewReplyDto;
import com.example.shop.modules.review.dto.ProductReviewSummaryDto;
import com.example.shop.modules.review.service.ProductReviewService;
import com.example.shop.modules.user.entity.User;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/seller/reviews")
@RequiredArgsConstructor
public class SellerReviewController {

    private final ProductReviewService reviewService;
    private final ProductRepository productRepository;

    /**
     * GET /api/v1/seller/reviews/{productId}?limit=20
     *
     * Lists reviews for a product that belongs to the authenticated seller.
     *
     * Example response: same as ProductReviewSummaryDto
     * {
     *   "success": true,
     *   "data": {
     *     "productID": "P001",
     *     "averageRating": 4.5,
     *     "reviewCount": 12,
     *     "reviews": [ { "id": "...", "rating": 5, "comment": "Great!", "author": "Alice", ... } ]
     *   }
     * }
     */
    @GetMapping("/{productId}")
    @PreAuthorize("hasRole('SELLER')")
    public ResponseEntity<ProductReviewSummaryDto> getReviewsForProduct(
            @AuthenticationPrincipal User user,
            @PathVariable String productId,
            @RequestParam(defaultValue = "20") int limit
    ) {
        assertOwnsProduct(user, productId);
        ProductReviewSummaryDto summary = reviewService.getReviews(productId, limit, user);
        return ResponseEntity.ok(summary);
    }

    /**
     * POST /api/v1/seller/reviews/{productId}/{reviewId}/reply
     *
     * Allows the seller to reply to a review on one of their own products.
     *
     * Request body:
     * { "content": "Thank you for your feedback! We're glad you loved it." }
     *
     * Example response: updated ProductReviewSummaryDto
     */
    @PostMapping("/{productId}/{reviewId}/reply")
    @PreAuthorize("hasRole('SELLER')")
    public ResponseEntity<ProductReviewSummaryDto> replyToReview(
            @AuthenticationPrincipal User user,
            @PathVariable String productId,
            @PathVariable String reviewId,
            @Valid @RequestBody ProductReviewReplyDto replyDto
    ) {
        assertOwnsProduct(user, productId);
        ProductReviewSummaryDto summary = reviewService.addReply(productId, reviewId, replyDto, user);
        return ResponseEntity.ok(summary);
    }

    // ── Helper ────────────────────────────────────────────────────────────────

    private void assertOwnsProduct(User user, String productId) {
        Product product = productRepository.findByProductID(productId)
                .orElseThrow(() -> new BusinessException("Product not found: " + productId, HttpStatus.NOT_FOUND));

        if (!user.getId().equals(product.getSellerUserId())) {
            throw new BusinessException("You do not own this product", HttpStatus.FORBIDDEN);
        }
    }
}

