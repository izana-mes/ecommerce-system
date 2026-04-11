package com.example.shop.modules.wishlist.repository;

import com.example.shop.modules.user.entity.User;
import com.example.shop.modules.wishlist.entity.WishlistItem;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface WishlistItemRepository extends JpaRepository<WishlistItem, Long> {

    List<WishlistItem> findByUser(User user);

    Optional<WishlistItem> findByUserAndProductID(User user, String productID);

    void deleteByUserAndProductID(User user, String productID);
}

