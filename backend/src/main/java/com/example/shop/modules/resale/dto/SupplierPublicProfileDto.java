package com.example.shop.modules.resale.dto;

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
public class SupplierPublicProfileDto {
    private UUID supplierId;
    private String displayName;
    private Boolean emailVerified;
    private LocalDateTime memberSince;
    private int activeProductCount;
    private int resaleEnabledProductCount;
}
