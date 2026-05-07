package com.example.shop.modules.seller.dashboard.dto;

import lombok.Builder;
import lombok.Getter;

import java.math.BigDecimal;
import java.util.List;

@Getter
@Builder
public class SellerDashboardResponse {

    private BigDecimal totalRevenue;
    private long totalOrders;
    private long cancelledOrders;
    private double cancelRate;
    private long totalProducts;
    private long lowStockCount;
    private BigDecimal availableBalance;
    private BigDecimal pendingBalance;

    private List<RevenuePoint> revenueByDay;
    private List<TopProductPoint> topSellingProducts;

    @Getter
    @Builder
    public static class RevenuePoint {
        private String day;
        private long orders;
        private BigDecimal revenue;
    }

    @Getter
    @Builder
    public static class TopProductPoint {
        private String productId;
        private String productName;
        private long soldQty;
        private BigDecimal revenue;
    }
}

