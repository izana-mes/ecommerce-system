package com.example.shop.modules.dashboard.service;

import com.example.shop.modules.dashboard.dto.DashboardStatsResponse;

/**
 * Service interface for retrieving dashboard statistics.
 */
public interface DashboardStatsService {
    /**
     * Fetch real-time stats directly from the database.
     *
     * @return DashboardStatsResponse containing count and aggregation metrics.
     */
    DashboardStatsResponse getStats();
}
