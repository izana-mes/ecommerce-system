package com.example.shop.modules.cart.dto;

import lombok.Data;

@Data
public class CartAddRequest {

    private String productID;
    private String productName;
    private Double productPrice;
    private String productReviews;
}

