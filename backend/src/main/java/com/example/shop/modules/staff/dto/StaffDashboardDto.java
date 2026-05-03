package com.example.shop.modules.staff.dto;

import java.math.BigDecimal;
import java.util.List;

public record StaffDashboardDto(
        long ordersToday,
        BigDecimal revenueToday,
        long activeShippers,
        long lateDeliveries,
        long nearLateDeliveries,
        long pendingOrders,
        long processingOrders,
        List<DailyRevenuePoint> revenueByDay
) {
    public record DailyRevenuePoint(
            String day,
            long orders,
            BigDecimal revenue
    ) {}
}
