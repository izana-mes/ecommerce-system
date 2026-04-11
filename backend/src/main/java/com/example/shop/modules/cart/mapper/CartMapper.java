package com.example.shop.modules.cart.mapper;

import com.example.shop.modules.cart.dto.CartItemDto;
import com.example.shop.modules.cart.entity.CartItem;
import org.mapstruct.Mapper;

@Mapper
public interface CartMapper {

    CartItemDto toDto(CartItem entity);
}
