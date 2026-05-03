package com.example.shop.modules.supplier.inventory.dto;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class StockUpdateRequest {

    @NotBlank(message = "productId is required")
    private String productId;

    @NotNull(message = "newQuantity is required")
    @Min(value = 0, message = "newQuantity must be >= 0")
    private Integer newQuantity;

    /** Optional override for the low-stock threshold used in alerts. Default = 5. */
    private Integer lowStockThreshold;
}
