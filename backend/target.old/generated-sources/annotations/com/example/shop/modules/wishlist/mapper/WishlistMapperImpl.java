package com.example.shop.modules.wishlist.mapper;

import com.example.shop.modules.wishlist.dto.WishlistItemDto;
import com.example.shop.modules.wishlist.entity.WishlistItem;
import javax.annotation.processing.Generated;

@Generated(
    value = "org.mapstruct.ap.MappingProcessor",
    date = "2026-10-12T16:49:55+0000",
    comments = "version: 1.5.5.Final, compiler: javac, environment: Java 21.0.7 (Eclipse Adoptium)"
)
public class WishlistMapperImpl implements WishlistMapper {

    @Override
    public WishlistItemDto toDto(WishlistItem entity) {
        if ( entity == null ) {
            return null;
        }

        WishlistItemDto wishlistItemDto = new WishlistItemDto();

        wishlistItemDto.setProductID( entity.getProductID() );
        wishlistItemDto.setProductName( entity.getProductName() );
        wishlistItemDto.setProductPrice( entity.getProductPrice() );
        wishlistItemDto.setProductReviews( entity.getProductReviews() );

        return wishlistItemDto;
    }
}
