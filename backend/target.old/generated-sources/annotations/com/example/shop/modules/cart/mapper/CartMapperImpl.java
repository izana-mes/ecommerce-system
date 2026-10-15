package com.example.shop.modules.cart.mapper;

import com.example.shop.modules.cart.dto.CartItemDto;
import com.example.shop.modules.cart.entity.CartItem;
import javax.annotation.processing.Generated;

@Generated(
    value = "org.mapstruct.ap.MappingProcessor",
    date = "2026-10-12T16:49:54+0000",
    comments = "version: 1.5.5.Final, compiler: javac, environment: Java 21.0.7 (Eclipse Adoptium)"
)
public class CartMapperImpl implements CartMapper {

    @Override
    public CartItemDto toDto(CartItem entity) {
        if ( entity == null ) {
            return null;
        }

        CartItemDto cartItemDto = new CartItemDto();

        cartItemDto.setProductID( entity.getProductID() );
        cartItemDto.setProductName( entity.getProductName() );
        cartItemDto.setProductPrice( entity.getProductPrice() );
        cartItemDto.setProductReviews( entity.getProductReviews() );
        cartItemDto.setQuantity( entity.getQuantity() );

        return cartItemDto;
    }
}
