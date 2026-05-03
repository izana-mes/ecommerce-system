package com.example.shop.modules.supplier.dashboard.controller;

import com.example.shop.common.response.ApiResponse;
import com.example.shop.modules.supplier.dashboard.dto.SupplierDashboardResponse;
import com.example.shop.modules.supplier.dashboard.service.SupplierDashboardService;
import com.example.shop.modules.user.entity.User;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/supplier/dashboard")
@RequiredArgsConstructor
public class SupplierDashboardController {

    private final SupplierDashboardService dashboardService;

    /**
     * GET /api/v1/supplier/dashboard
     *
     * Query params:
     *   days             (default 30)  – rolling window for trend charts
     *   lowStockThreshold (default 5)  – threshold for low-stock count
     *
     * Example response:
     * {
     *   "success": true,
     *   "data": {
     *     "totalRevenue": 1250.00,
     *     "totalOrders": 48,
     *     "cancelledOrders": 3,
     *     "cancelRate": 6.25,
     *     "totalProducts": 12,
     *     "lowStockCount": 2,
     *     "availableBalance": 1100.00,
     *     "pendingBalance": 0.00,
     *     "revenueByDay": [ { "day": "2026-05-01", "orders": 5, "revenue": 210.00 } ],
     *     "topSellingProducts": [ { "productId": "P001", "productName": "Widget", "soldQty": 30, "revenue": 600.00 } ]
     *   }
     * }
     */
    @GetMapping
    @PreAuthorize("hasRole('SUPPLIER')")
    public ResponseEntity<ApiResponse<SupplierDashboardResponse>> getDashboard(
            @AuthenticationPrincipal User user,
            @RequestParam(defaultValue = "30") int days,
            @RequestParam(defaultValue = "5") int lowStockThreshold
    ) {
        SupplierDashboardResponse response = dashboardService.getDashboard(user.getId(), days, lowStockThreshold);
        return ResponseEntity.ok(ApiResponse.success(response));
    }
}
