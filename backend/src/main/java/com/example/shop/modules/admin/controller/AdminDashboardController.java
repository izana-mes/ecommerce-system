package com.example.shop.modules.admin.controller;

import com.example.shop.common.response.ApiResponse;
import com.example.shop.modules.admin.dto.AdminDashboardResponse;
import com.example.shop.modules.admin.service.AdminDashboardService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/admin")
@RequiredArgsConstructor
public class AdminDashboardController {

    private final AdminDashboardService adminDashboardService;

    @GetMapping("/dashboard")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<AdminDashboardResponse>> getDashboard(
            @RequestParam(value = "days", required = false, defaultValue = "7") int days,
            @RequestParam(value = "recentLimit", required = false, defaultValue = "8") int recentLimit,
            @RequestParam(value = "lowStockThreshold", required = false, defaultValue = "5") int lowStockThreshold
    ) {
        AdminDashboardResponse response = adminDashboardService.getDashboard(days, recentLimit, lowStockThreshold);
        return ResponseEntity.ok(ApiResponse.success(response));
    }
}
