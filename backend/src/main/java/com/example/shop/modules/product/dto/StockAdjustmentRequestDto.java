package com.example.shop.modules.product.dto;

import lombok.Data;

import java.util.List;

@Data
public class StockAdjustmentRequestDto {
    private List<StockAdjustmentItemDto> items;
}
