package com.example.shop.modules.cart.dto;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class CartCheckoutHealthItemDto {

    private String productID;
    private String productName;
    private Integer requestedQuantity;
    private Integer availableQuantity;
    private Boolean active;
    private String reason;
}
