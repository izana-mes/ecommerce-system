package com.example.shop.modules.wishlist.dto;

import lombok.Data;

@Data
public class WishlistItemDto {

    private String productID;
    private String productName;
    private Double productPrice;
    private String productReviews;
}

