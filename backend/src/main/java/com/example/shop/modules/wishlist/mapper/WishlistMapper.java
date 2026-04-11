package com.example.shop.modules.wishlist.mapper;

import com.example.shop.modules.wishlist.dto.WishlistItemDto;
import com.example.shop.modules.wishlist.entity.WishlistItem;
import org.mapstruct.Mapper;

@Mapper
public interface WishlistMapper {

    WishlistItemDto toDto(WishlistItem entity);
}
