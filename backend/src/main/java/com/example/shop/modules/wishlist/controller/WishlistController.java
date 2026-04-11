package com.example.shop.modules.wishlist.controller;

import com.example.shop.modules.user.entity.User;
import com.example.shop.modules.wishlist.dto.WishlistItemDto;
import com.example.shop.modules.wishlist.service.WishlistService;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/wishlist")
@RequiredArgsConstructor
public class WishlistController {

    private final WishlistService wishlistService;

    @GetMapping
    public ResponseEntity<List<WishlistItemDto>> getWishlist(@AuthenticationPrincipal User user) {
        return ResponseEntity.ok(wishlistService.getWishlist(user));
    }

    @PostMapping
    public ResponseEntity<WishlistItemDto> addToWishlist(@RequestBody WishlistItemDto request,
                                                         @AuthenticationPrincipal User user) {
        WishlistItemDto dto = wishlistService.addToWishlist(user, request);
        return ResponseEntity.ok(dto);
    }

    @DeleteMapping("/{productID}")
    public ResponseEntity<SimpleMessageResponse> removeFromWishlist(@PathVariable("productID") String productID,
                                                                    @AuthenticationPrincipal User user) {
        wishlistService.removeFromWishlist(user, productID);
        SimpleMessageResponse response = new SimpleMessageResponse();
        response.setMessage("Removed from wishlist");
        return ResponseEntity.ok(response);
    }

    @Data
    private static class SimpleMessageResponse {
        private String message;
    }
}
