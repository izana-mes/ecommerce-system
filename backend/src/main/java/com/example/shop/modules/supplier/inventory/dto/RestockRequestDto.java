package com.example.shop.modules.supplier.inventory.dto;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
public class RestockRequestDto {

    @NotBlank(message = "productId is required")
    private String productId;

    /** Desired quantity to restock. */
    @NotNull(message = "requestedQuantity is required")
    @Min(value = 1, message = "requestedQuantity must be at least 1")
    private Integer requestedQuantity;

    /** Optional note to the platform admin explaining the urgency. */
    private String note;
}
