package com.example.shop.modules.product.mapper;

import com.example.shop.modules.product.dto.ProductDto;
import com.example.shop.modules.product.entity.Product;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

@Mapper(componentModel = "spring")
public interface ProductMapper {

    ProductDto toDto(Product entity);

    @Mapping(target = "id", ignore = true)
    Product toEntity(ProductDto dto);
}

