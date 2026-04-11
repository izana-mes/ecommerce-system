package com.example.shop.modules.order.service;

import com.example.shop.modules.order.dto.OrderCreateRequest;
import com.example.shop.modules.order.dto.OrderCreateResponse;
import com.example.shop.modules.order.dto.OrderHistoryItemDto;
import com.example.shop.modules.user.entity.User;

import java.util.List;

public interface OrderService {
    OrderCreateResponse createOrder(OrderCreateRequest request, User user);

    List<OrderHistoryItemDto> getMyOrders(User user, int limit);
}
