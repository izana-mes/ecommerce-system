package com.example.shop.modules.product.mapper;

import com.example.shop.modules.product.dto.ProductDto;
import com.example.shop.modules.product.entity.Product;
import javax.annotation.processing.Generated;
import org.springframework.stereotype.Component;

@Generated(
    value = "org.mapstruct.ap.MappingProcessor",
    date = "2026-10-12T16:49:54+0000",
    comments = "version: 1.5.5.Final, compiler: javac, environment: Java 21.0.7 (Eclipse Adoptium)"
)
@Component
public class ProductMapperImpl implements ProductMapper {

    @Override
    public ProductDto toDto(Product entity) {
        if ( entity == null ) {
            return null;
        }

        ProductDto productDto = new ProductDto();

        productDto.setProductID( entity.getProductID() );
        productDto.setFrontImg( entity.getFrontImg() );
        productDto.setBackImg( entity.getBackImg() );
        productDto.setProductName( entity.getProductName() );
        productDto.setProductPrice( entity.getProductPrice() );
        productDto.setOldPrice( entity.getOldPrice() );
        productDto.setProductReviews( entity.getProductReviews() );
        productDto.setCategory( entity.getCategory() );
        productDto.setSizes( map( entity.getSizes() ) );
        productDto.setStockQuantity( entity.getStockQuantity() );
        productDto.setActive( entity.getActive() );
        productDto.setSupplierUserId( entity.getSupplierUserId() );

        return productDto;
    }

    @Override
    public Product toEntity(ProductDto dto) {
        if ( dto == null ) {
            return null;
        }

        Product.ProductBuilder product = Product.builder();

        product.productID( dto.getProductID() );
        product.frontImg( dto.getFrontImg() );
        product.backImg( dto.getBackImg() );
        product.productName( dto.getProductName() );
        product.productPrice( dto.getProductPrice() );
        product.oldPrice( dto.getOldPrice() );
        product.productReviews( dto.getProductReviews() );
        product.category( dto.getCategory() );
        product.sizes( map( dto.getSizes() ) );
        product.stockQuantity( dto.getStockQuantity() );
        product.active( dto.getActive() );

        return product.build();
    }
}
