package com.example.shop.modules.ordercheckouthistory.service;

import com.example.shop.modules.order.dto.OrderCreateRequest;
import com.example.shop.modules.ordercheckouthistory.dto.CheckoutHistoryEntryDto;
import com.example.shop.modules.user.entity.User;

import java.util.List;

public interface OrderCheckoutHistoryService {
    void saveCheckoutInfo(User user, OrderCreateRequest request, String effectiveEmail);

    List<CheckoutHistoryEntryDto> getHistory(User user, int limit);

    void clearHistory(User user);
}
