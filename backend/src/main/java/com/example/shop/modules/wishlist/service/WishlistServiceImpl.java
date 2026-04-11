package com.example.shop.modules.wishlist.service;

import com.example.shop.modules.user.entity.User;
import com.example.shop.modules.wishlist.dto.WishlistItemDto;
import com.example.shop.modules.wishlist.entity.WishlistItem;
import com.example.shop.modules.wishlist.repository.WishlistItemRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
@Transactional
public class WishlistServiceImpl implements WishlistService {

    private final WishlistItemRepository wishlistItemRepository;

    @Override
    @Transactional(readOnly = true)
    public List<WishlistItemDto> getWishlist(User user) {
        return wishlistItemRepository.findByUser(user)
                .stream()
                .map(this::toDto)
                .toList();
    }

    @Override
    public WishlistItemDto addToWishlist(User user, WishlistItemDto request) {
        WishlistItem item = wishlistItemRepository.findByUserAndProductID(user, request.getProductID())
                .orElseGet(() -> WishlistItem.builder()
                        .user(user)
                        .productID(request.getProductID())
                        .productName(request.getProductName())
                        .productPrice(request.getProductPrice())
                        .productReviews(request.getProductReviews())
                        .build());

        WishlistItem saved = wishlistItemRepository.save(item);
        return toDto(saved);
    }

    @Override
    public void removeFromWishlist(User user, String productID) {
        wishlistItemRepository.deleteByUserAndProductID(user, productID);
    }

    private WishlistItemDto toDto(WishlistItem entity) {
        if (entity == null) {
            return null;
        }

        WishlistItemDto dto = new WishlistItemDto();
        dto.setProductID(entity.getProductID());
        dto.setProductName(entity.getProductName());
        dto.setProductPrice(entity.getProductPrice());
        dto.setProductReviews(entity.getProductReviews());
        return dto;
    }
}
