package com.example.shop.modules.cart.service;

import com.example.shop.modules.cart.dto.CartAddRequest;
import com.example.shop.modules.cart.dto.CartCheckoutHealthResponseDto;
import com.example.shop.modules.cart.dto.CartItemDto;
import com.example.shop.modules.user.entity.User;

import java.util.List;

public interface CartService {

    List<CartItemDto> getCart(User user);

    CartItemDto addToCart(User user, CartAddRequest request);

    CartItemDto updateQuantity(User user, String productID, int quantity);

    void removeFromCart(User user, String productID);

    void clearCart(User user);

    CartCheckoutHealthResponseDto getCheckoutHealth(User user);
}
