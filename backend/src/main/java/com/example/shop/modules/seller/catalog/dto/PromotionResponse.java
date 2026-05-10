package com.example.shop.modules.seller.catalog.dto;

import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class PromotionResponse {
    private String productId;
    private String productName;
    private Double originalPrice;
    private Double salePrice;
    private boolean onPromotion;
    private String message;
}
