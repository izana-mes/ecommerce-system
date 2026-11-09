package com.example.shop.modules.product.dto;

import lombok.Builder;
import lombok.Getter;

import java.util.UUID;

@Getter
@Builder
public class ProductSuggestionDto {
    private String productID;
    private String productName;
    private String frontImg;
    private Double productPrice;
    private UUID sellerUserId;
    private UUID supplierUserId;
}
