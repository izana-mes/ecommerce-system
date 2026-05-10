package com.example.shop.modules.seller.catalog.controller;

import com.example.shop.common.response.ApiResponse;
import com.example.shop.modules.seller.catalog.dto.PromotionRequest;
import com.example.shop.modules.seller.catalog.dto.PromotionResponse;
import com.example.shop.modules.seller.catalog.service.SellerPromotionService;
import com.example.shop.modules.user.entity.User;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

/**
 * Seller-scoped promotion management.
 *
 * <p>PUT  /api/v1/seller/products/{productId}/promotion  – apply a sale price
 * <p>DELETE /api/v1/seller/products/{productId}/promotion – remove the promotion
 */
@RestController
@RequestMapping("/api/v1/seller/products/{productId}/promotion")
@RequiredArgsConstructor
public class SellerPromotionController {

    private final SellerPromotionService promotionService;

    /**
     * Apply a promotional (discounted) price to a seller-owned product.
     *
     * <p>Request body: {@code { "salePrice": 29.99 }}
     * <p>The current price is archived in {@code oldPrice}; the sale price
     * becomes the active {@code productPrice}.
     */
    @PutMapping
    @PreAuthorize("hasRole('SELLER')")
    public ResponseEntity<ApiResponse<PromotionResponse>> applyPromotion(
            @AuthenticationPrincipal User user,
            @PathVariable String productId,
            @Valid @RequestBody PromotionRequest request
    ) {
        PromotionResponse response = promotionService.applyPromotion(user.getId(), productId, request);
        return ResponseEntity.ok(ApiResponse.success(response, response.getMessage()));
    }

    /**
     * Remove the active promotion on a seller-owned product, restoring the original price.
     */
    @DeleteMapping
    @PreAuthorize("hasRole('SELLER')")
    public ResponseEntity<ApiResponse<PromotionResponse>> clearPromotion(
            @AuthenticationPrincipal User user,
            @PathVariable String productId
    ) {
        PromotionResponse response = promotionService.clearPromotion(user.getId(), productId);
        return ResponseEntity.ok(ApiResponse.success(response, response.getMessage()));
    }
}
