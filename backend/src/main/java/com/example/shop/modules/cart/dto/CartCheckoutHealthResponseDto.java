package com.example.shop.modules.cart.dto;

import lombok.Builder;
import lombok.Data;

import java.util.List;

@Data
@Builder
public class CartCheckoutHealthResponseDto {

    private Boolean canCheckout;
    private Integer itemCount;
    private Integer invalidItemCount;
    private List<CartCheckoutHealthItemDto> invalidItems;
}
