package com.example.shop.modules.dashboard.websocket;

import com.example.shop.modules.dashboard.dto.DashboardStatsResponse;
import com.example.shop.modules.dashboard.service.DashboardStatsService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Component;

/**
 * Component responsible for broadcasting database statistics updates via WebSockets.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class DashboardStatsBroadcaster {

    private final SimpMessagingTemplate messagingTemplate;
    private final DashboardStatsService dashboardStatsService;

    /**
     * Fetch current statistics and send them to the "/topic/stats" destination.
     */
    public void broadcast() {
        try {
            DashboardStatsResponse stats = dashboardStatsService.getStats();
            messagingTemplate.convertAndSend("/topic/stats", stats);
            log.info("Successfully broadcasted real-time statistics to /topic/stats");
        } catch (Exception e) {
            log.error("Failed to broadcast real-time statistics", e);
        }
    }
}
