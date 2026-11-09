package com.example.shop.modules.resale.dto;

import com.example.shop.modules.resale.entity.SellerProductListing;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SellerProductListingDto {
    private UUID id;
    private UUID authorizationId;
    private String supplierProductId;
    private String supplierProductName;
    private String supplierProductImage;
    private UUID sellerUserId;
    private String sellerDisplayName;
    private UUID supplierUserId;
    private String supplierDisplayName;
    private String customTitle;
    private BigDecimal retailPrice;
    private Boolean active;
    private Integer allocatedQuantity;
    private Integer soldQuantity;
    private Integer reservedQuantity;
    private Integer remainingQuantity;
    private LocalDateTime createdAt;

    public static SellerProductListingDto fromEntity(SellerProductListing e) {
        return SellerProductListingDto.builder()
                .id(e.getId())
                .authorizationId(e.getAuthorization() == null ? null : e.getAuthorization().getId())
                .supplierProductId(e.getSupplierProductId())
                .sellerUserId(e.getSeller() == null ? null : e.getSeller().getId())
                .supplierUserId(e.getSupplierUserId())
                .customTitle(e.getCustomTitle())
                .retailPrice(e.getRetailPrice())
                .active(e.getActive())
                .createdAt(e.getCreatedAt())
                .build();
    }
}
