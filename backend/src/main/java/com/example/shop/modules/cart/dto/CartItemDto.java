package com.example.shop.modules.cart.dto;

import lombok.Data;

@Data
public class CartItemDto {

    private String productID;
    private String productName;
    private Double productPrice;
    private String productReviews;
    private Integer quantity;
    private Integer availableStock;
    private Boolean active;
    private Boolean purchasable;
}
