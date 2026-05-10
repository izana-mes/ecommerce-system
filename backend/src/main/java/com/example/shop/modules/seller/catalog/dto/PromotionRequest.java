package com.example.shop.modules.seller.catalog.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
public class PromotionRequest {

    /** The discounted sale price. Must be positive and less than the current price. */
    @NotNull(message = "Sale price is required")
    @DecimalMin(value = "0.01", message = "Sale price must be at least 0.01")
    private Double salePrice;
}
