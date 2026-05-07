package com.example.shop.modules.seller.dashboard.service;

import com.example.shop.modules.seller.dashboard.dto.SellerDashboardResponse;

import java.util.UUID;

public interface SellerDashboardService {

    SellerDashboardResponse getDashboard(UUID sellerUserId, int days, int lowStockThreshold);
}

