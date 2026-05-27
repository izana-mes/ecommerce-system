package com.example.shop.modules.product.service;

import com.example.shop.modules.product.dto.ProductDto;
import com.example.shop.modules.user.entity.User;

import java.util.List;

public interface RecentlyViewedProductService {

    void track(User user, String productId);

    List<ProductDto> getRecentlyViewed(User user, int limit);

    void clear(User user);
}
