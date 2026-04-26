package com.example.shop.modules.product.mapper;

import com.example.shop.modules.product.dto.ProductDto;
import com.example.shop.modules.product.entity.Product;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

import java.util.Arrays;
import java.util.List;

@Mapper(componentModel = "spring")
public interface ProductMapper {

    ProductDto toDto(Product entity);

    @Mapping(target = "id", ignore = true)
    Product toEntity(ProductDto dto);

    default List<String> map(String value) {
        if (value == null || value.isBlank()) {
            return List.of();
        }
        return Arrays.stream(value.split(","))
                .map(String::trim)
                .filter(item -> !item.isEmpty())
                .distinct()
                .toList();
    }

    default String map(List<String> value) {
        if (value == null || value.isEmpty()) {
            return "";
        }
        return value.stream()
                .map(item -> item == null ? "" : item.trim())
                .filter(item -> !item.isEmpty())
                .distinct()
                .reduce((left, right) -> left + "," + right)
                .orElse("");
    }
}
