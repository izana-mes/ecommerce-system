package com.example.shop.modules.dashboard.controller;

import com.example.shop.common.response.ApiResponse;
import com.example.shop.modules.dashboard.dto.DashboardStatsResponse;
import com.example.shop.modules.dashboard.service.DashboardStatsService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Controller exposing real-time stats endpoint.
 */
@RestController
@RequestMapping("/api/v1/dashboard")
@RequiredArgsConstructor
public class DashboardStatsController {

    private final DashboardStatsService dashboardStatsService;

    /**
     * GET /api/v1/dashboard/stats
     *
     * @return ApiResponse containing the current database stats.
     */
    @GetMapping("/stats")
    public ResponseEntity<ApiResponse<DashboardStatsResponse>> getStats() {
        DashboardStatsResponse stats = dashboardStatsService.getStats();
        return ResponseEntity.ok(ApiResponse.success(stats));
    }
}
