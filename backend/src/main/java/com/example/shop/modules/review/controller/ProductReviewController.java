package com.example.shop.modules.review.controller;

import com.example.shop.modules.review.dto.ProductReviewRequest;
import com.example.shop.modules.review.dto.ProductReviewSummaryDto;
import com.example.shop.modules.review.service.ProductReviewService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/products/{productID}/reviews")
@RequiredArgsConstructor
public class ProductReviewController {

    private final ProductReviewService productReviewService;

    @GetMapping
    public ResponseEntity<ProductReviewSummaryDto> getReviews(
            @PathVariable("productID") String productID,
            @RequestParam(value = "limit", required = false, defaultValue = "10") int limit,
            @AuthenticationPrincipal Object principal
    ) {
        return ResponseEntity.ok(productReviewService.getReviews(productID, limit, principal));
    }

    @PostMapping
    public ResponseEntity<ProductReviewSummaryDto> addReview(
            @PathVariable("productID") String productID,
            @Valid @RequestBody ProductReviewRequest request,
            @AuthenticationPrincipal Object principal
    ) {
        return ResponseEntity.ok(productReviewService.addReview(productID, request, principal));
    }

    @PutMapping("/{reviewID}")
    public ResponseEntity<ProductReviewSummaryDto> updateReview(
            @PathVariable("productID") String productID,
            @PathVariable("reviewID") String reviewID,
            @Valid @RequestBody ProductReviewRequest request,
            @AuthenticationPrincipal Object principal
    ) {
        return ResponseEntity.ok(productReviewService.updateReview(productID, reviewID, request, principal));
    }

    @DeleteMapping("/{reviewID}")
    public ResponseEntity<ProductReviewSummaryDto> deleteReview(
            @PathVariable("productID") String productID,
            @PathVariable("reviewID") String reviewID,
            @AuthenticationPrincipal Object principal
    ) {
        return ResponseEntity.ok(productReviewService.deleteReview(productID, reviewID, principal));
    }
}
