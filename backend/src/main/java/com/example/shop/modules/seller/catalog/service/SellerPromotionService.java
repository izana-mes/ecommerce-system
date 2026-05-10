package com.example.shop.modules.seller.catalog.service;

import com.example.shop.modules.seller.catalog.dto.PromotionRequest;
import com.example.shop.modules.seller.catalog.dto.PromotionResponse;

import java.util.UUID;

public interface SellerPromotionService {

    /** Apply a discounted price to a seller's product. */
    PromotionResponse applyPromotion(UUID sellerUserId, String productId, PromotionRequest request);

    /** Remove any active promotion, restoring the original price. */
    PromotionResponse clearPromotion(UUID sellerUserId, String productId);
}
