package com.example.shop.modules.supplier.inventory.dto;

import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class InventoryItemDto {
    private String productId;
    private String productName;
    private Integer stockQuantity;
    private Integer lowStockThreshold;
    private boolean lowStock;
    private boolean active;
}
