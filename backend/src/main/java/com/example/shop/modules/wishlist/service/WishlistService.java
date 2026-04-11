package com.example.shop.modules.wishlist.service;

import com.example.shop.modules.user.entity.User;
import com.example.shop.modules.wishlist.dto.WishlistItemDto;

import java.util.List;

public interface WishlistService {

    List<WishlistItemDto> getWishlist(User user);

    WishlistItemDto addToWishlist(User user, WishlistItemDto request);

    void removeFromWishlist(User user, String productID);
}

