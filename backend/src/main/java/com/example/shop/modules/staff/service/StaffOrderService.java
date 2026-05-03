package com.example.shop.modules.staff.service;

import com.example.shop.modules.staff.dto.StaffOrderDto;
import com.example.shop.modules.staff.dto.StaffOrderFilterRequest;
import com.example.shop.modules.staff.dto.StaffOrderPageDto;

public interface StaffOrderService {
    StaffOrderPageDto listOrders(StaffOrderFilterRequest filter);
    void overrideOrderStatus(Long orderId, String orderStatus, String paymentStatus, String reason, String changedBy);
}
