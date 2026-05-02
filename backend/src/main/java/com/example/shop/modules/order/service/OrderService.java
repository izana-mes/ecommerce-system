package com.example.shop.modules.order.service;

import com.example.shop.modules.order.dto.OrderCreateRequest;
import com.example.shop.modules.order.dto.OrderCreateResponse;
import com.example.shop.modules.order.dto.OrderHistoryItemDto;
import com.example.shop.modules.order.dto.OrderTrackingDto;
import com.example.shop.modules.user.entity.User;

import java.util.List;
import java.util.Map;
import java.util.Optional;

public interface OrderService {
    OrderCreateResponse createOrder(OrderCreateRequest request, User user);

    void cancelOrder(String orderNumber, User user);

    OrderHistoryItemDto editOrder(String orderNumber, com.example.shop.modules.order.dto.OrderEditRequest request, User user);

    List<OrderHistoryItemDto> getMyOrders(User user, int limit);

    /** Admin/staff-scoped: look up a single order by order number (no email restriction). */
    Optional<OrderHistoryItemDto> findOrderByNumberForAdmin(String orderNumber);

    /** Admin/staff-scoped: look up recent orders for a customer email (no ownership restriction). */
    List<OrderHistoryItemDto> findOrdersByEmailForAdmin(String email, int limit);

    Optional<OrderTrackingDto> getOrderTrackingBySecret(String trackingSecret);

    Optional<OrderTrackingDto> getOrderTrackingByNumberForCustomer(String orderNumber, User user);

    /**
     * Counts useful for ops dashboards (employees / admins). Shippers do not receive payment-sensitive splits here.
     */
    Map<String, Long> fulfillmentInsightsForStaff();
}
