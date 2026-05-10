package com.example.shop.modules.supplier.inventory.dto;

import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class RestockRequestResponseDto {
    private String productId;
    private String productName;
    private Integer currentStock;
    private Integer requestedQuantity;
    private String note;
    private String status;
    private String message;
}
