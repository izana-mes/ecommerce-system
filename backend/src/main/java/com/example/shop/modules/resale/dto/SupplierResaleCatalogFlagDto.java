package com.example.shop.modules.resale.dto;

import com.example.shop.modules.resale.entity.SupplierResaleCatalogFlag;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SupplierResaleCatalogFlagDto {
    private Long id;
    private String productId;
    private String productName;
    private Double productPrice;
    private String frontImg;
    private UUID supplierUserId;
    private Boolean resaleEnabled;
    private java.math.BigDecimal wholesalePrice;
    private Integer minimumOrderQuantity;
    private Boolean supplierProductApproved;
    private String commercialNote;
    private LocalDateTime updatedAt;

    public static SupplierResaleCatalogFlagDto fromEntity(SupplierResaleCatalogFlag e) {
        return SupplierResaleCatalogFlagDto.builder()
                .id(e.getId())
                .productId(e.getProductId())
                .supplierUserId(e.getSupplierUserId())
                .resaleEnabled(e.getResaleEnabled())
                .wholesalePrice(e.getWholesalePrice())
                .minimumOrderQuantity(e.getMinimumOrderQuantity())
                .supplierProductApproved(e.getSupplierProductApproved())
                .commercialNote(e.getCommercialNote())
                .updatedAt(e.getUpdatedAt())
                .build();
    }
}
