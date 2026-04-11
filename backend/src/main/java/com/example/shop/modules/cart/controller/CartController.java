package com.example.shop.modules.cart.controller;

import com.example.shop.modules.cart.dto.CartAddRequest;
import com.example.shop.modules.cart.dto.CartCheckoutHealthResponseDto;
import com.example.shop.modules.cart.dto.CartItemDto;
import com.example.shop.modules.cart.dto.CartUpdateQuantityRequest;
import com.example.shop.modules.cart.service.CartService;
import com.example.shop.modules.user.entity.User;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/cart")
@RequiredArgsConstructor
public class CartController {

    private final CartService cartService;

    @GetMapping
    public ResponseEntity<List<CartItemDto>> getCart(@AuthenticationPrincipal User user) {
        return ResponseEntity.ok(cartService.getCart(user));
    }

    @PostMapping
    public ResponseEntity<CartAddResponse> addToCart(@RequestBody CartAddRequest request,
                                                     @AuthenticationPrincipal User user) {
        CartItemDto dto = cartService.addToCart(user, request);
        CartAddResponse response = new CartAddResponse();
        response.setProductID(dto.getProductID());
        response.setQuantity(dto.getQuantity());
        return ResponseEntity.ok(response);
    }

    @PutMapping("/{productID}")
    public ResponseEntity<CartItemDto> updateQuantity(@PathVariable("productID") String productID,
                                                      @RequestBody CartUpdateQuantityRequest request,
                                                      @AuthenticationPrincipal User user) {
        if (request.getQuantity() == null) {
            throw new IllegalStateException("Quantity is required");
        }

        CartItemDto dto = cartService.updateQuantity(user, productID, request.getQuantity());
        return ResponseEntity.ok(dto);
    }

    @DeleteMapping("/{productID}")
    public ResponseEntity<SimpleMessageResponse> removeFromCart(@PathVariable("productID") String productID,
                                                                @AuthenticationPrincipal User user) {
        cartService.removeFromCart(user, productID);
        SimpleMessageResponse response = new SimpleMessageResponse();
        response.setMessage("Removed from cart");
        return ResponseEntity.ok(response);
    }

    @DeleteMapping("/clear")
    public ResponseEntity<SimpleMessageResponse> clearCart(@AuthenticationPrincipal User user) {
        cartService.clearCart(user);
        SimpleMessageResponse response = new SimpleMessageResponse();
        response.setMessage("Cart cleared");
        return ResponseEntity.ok(response);
    }

    @GetMapping("/checkout-health")
    public ResponseEntity<CartCheckoutHealthResponseDto> getCheckoutHealth(@AuthenticationPrincipal User user) {
        return ResponseEntity.ok(cartService.getCheckoutHealth(user));
    }

    @Data
    private static class CartAddResponse {
        private String productID;
        private Integer quantity;
    }

    @Data
    private static class SimpleMessageResponse {
        private String message;
    }
}
