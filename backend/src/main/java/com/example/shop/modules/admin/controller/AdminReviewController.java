package com.example.shop.modules.admin.controller;

import com.example.shop.common.response.ApiResponse;
import com.example.shop.modules.review.dto.AdminProductReviewPageDto;
import com.example.shop.modules.review.dto.ProductReviewDto;
import com.example.shop.modules.review.dto.ProductReviewRequest;
import com.example.shop.modules.review.service.ProductReviewService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/v1/admin/reviews")
@RequiredArgsConstructor
public class AdminReviewController {

    private final ProductReviewService productReviewService;

    @GetMapping
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<AdminProductReviewPageDto>> getReviews(
            @RequestParam(value = "q", required = false) String query,
            @RequestParam(value = "page", required = false, defaultValue = "0") int page,
            @RequestParam(value = "size", required = false, defaultValue = "10") int size
    ) {
        AdminProductReviewPageDto response = productReviewService.getReviewsForAdmin(query, page, size);
        return ResponseEntity.ok(ApiResponse.success(response));
    }

    @PutMapping("/{productID}/{reviewID}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<ProductReviewDto>> updateReview(
            @PathVariable("productID") String productID,
            @PathVariable("reviewID") String reviewID,
            @Valid @RequestBody ProductReviewRequest request
    ) {
        ProductReviewDto response = productReviewService.updateReviewAsAdmin(productID, reviewID, request);
        return ResponseEntity.ok(ApiResponse.success(response));
    }

    @DeleteMapping("/{productID}/{reviewID}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<Map<String, Object>>> deleteReview(
            @PathVariable("productID") String productID,
            @PathVariable("reviewID") String reviewID
    ) {
        productReviewService.deleteReviewAsAdmin(productID, reviewID);
        return ResponseEntity.ok(ApiResponse.success(Map.of(
                "deleted", true,
                "productID", productID,
                "reviewID", reviewID
        )));
    }
}
