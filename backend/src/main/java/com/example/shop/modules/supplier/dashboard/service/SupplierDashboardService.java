package com.example.shop.modules.supplier.dashboard.service;

import com.example.shop.modules.supplier.dashboard.dto.SupplierDashboardResponse;

import java.util.UUID;

public interface SupplierDashboardService {

    SupplierDashboardResponse getDashboard(UUID supplierUserId, int days, int lowStockThreshold);
}
