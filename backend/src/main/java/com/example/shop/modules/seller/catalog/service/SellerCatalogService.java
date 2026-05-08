package com.example.shop.modules.seller.catalog.service;

import com.example.shop.modules.product.dto.ProductDto;

import java.util.List;
import java.util.UUID;

public interface SellerCatalogService {
    List<ProductDto> listSellerProducts(UUID sellerUserId, String query);

    ProductDto createSellerProduct(UUID sellerUserId, ProductDto payload);

    ProductDto updateSellerProduct(UUID sellerUserId, String productId, ProductDto payload);

    void deleteSellerProduct(UUID sellerUserId, String productId);
}

