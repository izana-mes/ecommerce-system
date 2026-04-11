package com.example.shop.modules.product.dto;

import lombok.Data;

@Data
public class StockAdjustmentItemDto {
    private String productID;
    private Integer quantity;
}
