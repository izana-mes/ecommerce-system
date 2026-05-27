package com.example.shop.modules.product.service;

import com.example.shop.modules.product.dto.ProductDto;

import java.util.List;

public interface ProductTrendingService {

    void trackProductView(String productId);

    List<ProductDto> getTrendingProducts(int limit);
}
