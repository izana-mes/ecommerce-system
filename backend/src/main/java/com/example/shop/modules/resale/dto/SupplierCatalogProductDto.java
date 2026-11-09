package com.example.shop.modules.resale.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SupplierCatalogProductDto {
    private String productId;
    private UUID supplierProductId;
    private String productName;
    private String sku;
    private String brand;
    private String category;
    private Double productPrice;
    private java.math.BigDecimal wholesalePrice;
    private Integer stockQuantity;
    private Integer minimumOrderQuantity;
    private Boolean availableToSellers;
    private Boolean allowResale;
    private String frontImg;
    private String backImg;
    private String productReviews;
    private Boolean active;
    private UUID supplierUserId;
    private String supplierDisplayName;
    private String commercialNote;
    private String myRequestStatus;
    private String myRequestId;
    private Boolean hasActiveAuthorization;
}
