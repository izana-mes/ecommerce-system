package com.example.shop.modules.staff.service;

import com.example.shop.config.RedisCacheConfig;
import com.example.shop.modules.staff.dto.StaffDashboardDto;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.dao.DataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.Collections;
import java.util.List;

@Service
@RequiredArgsConstructor
@Slf4j
public class StaffDashboardService {

    private final JdbcTemplate jdbcTemplate;

    @Transactional(readOnly = true)
    @Cacheable(cacheNames = RedisCacheConfig.STAFF_DASHBOARD, key = "'default'")
    public StaffDashboardDto getDashboard() {
        long ordersToday = queryLong(
                "SELECT COUNT(*) FROM orders WHERE DATE(created_at) = CURRENT_DATE", 0L);

        BigDecimal revenueToday = queryBigDecimal(
                "SELECT COALESCE(SUM(total_amount), 0) FROM orders WHERE DATE(created_at) = CURRENT_DATE AND payment_status IN ('paid','authorized')",
                BigDecimal.ZERO);

        // Active shippers = shippers with at least one non-terminal order
        long activeShippers = queryLong("""
                SELECT COUNT(DISTINCT shipper_user_id)
                FROM orders
                WHERE shipper_user_id IS NOT NULL
                  AND order_status NOT IN ('completed', 'cancelled', 'delivered', 'failed')
                """, 0L);

        // Late = expected_delivery_at in the past and not yet delivered/completed
        long lateDeliveries = queryLong("""
                SELECT COUNT(*)
                FROM orders
                WHERE expected_delivery_at IS NOT NULL
                  AND expected_delivery_at < CURRENT_TIMESTAMP
                  AND delivered_at IS NULL
                  AND order_status NOT IN ('completed', 'cancelled', 'delivered', 'failed')
                """, 0L);

        // Near-late = delivery deadline within next 30 minutes
        long nearLateDeliveries = queryLong("""
                SELECT COUNT(*)
                FROM orders
                WHERE expected_delivery_at IS NOT NULL
                  AND expected_delivery_at >= CURRENT_TIMESTAMP
                  AND expected_delivery_at <= CURRENT_TIMESTAMP + INTERVAL '30 minutes'
                  AND delivered_at IS NULL
                  AND order_status NOT IN ('completed', 'cancelled', 'delivered', 'failed')
                """, 0L);

        long pendingOrders = queryLong(
                "SELECT COUNT(*) FROM orders WHERE order_status = 'pending'", 0L);

        long processingOrders = queryLong(
                "SELECT COUNT(*) FROM orders WHERE order_status = 'processing'", 0L);

        List<StaffDashboardDto.DailyRevenuePoint> revenueByDay = queryRevenueByDay(7);

        return new StaffDashboardDto(
                ordersToday,
                revenueToday,
                activeShippers,
                lateDeliveries,
                nearLateDeliveries,
                pendingOrders,
                processingOrders,
                revenueByDay
        );
    }

    private List<StaffDashboardDto.DailyRevenuePoint> queryRevenueByDay(int days) {
        try {
            return jdbcTemplate.query("""
                    SELECT TO_CHAR(DATE(created_at), 'YYYY-MM-DD') AS day,
                           COUNT(*)                                  AS orders,
                           COALESCE(SUM(total_amount), 0)            AS revenue
                    FROM orders
                    WHERE DATE(created_at) >= CURRENT_DATE - (? - 1)
                    GROUP BY DATE(created_at)
                    ORDER BY DATE(created_at) ASC
                    """,
                    (rs, rowNum) -> new StaffDashboardDto.DailyRevenuePoint(
                            rs.getString("day"),
                            rs.getLong("orders"),
                            rs.getBigDecimal("revenue")
                    ),
                    days
            );
        } catch (DataAccessException ex) {
            log.warn("Staff dashboard revenue-by-day query failed: {}", ex.getMessage());
            return Collections.emptyList();
        }
    }

    private long queryLong(String sql, long fallback, Object... args) {
        try {
            Long value = jdbcTemplate.queryForObject(sql, Long.class, args);
            return value == null ? fallback : value;
        } catch (DataAccessException ex) {
            log.warn("Staff dashboard query failed: {}", ex.getMessage());
            return fallback;
        }
    }

    private BigDecimal queryBigDecimal(String sql, BigDecimal fallback, Object... args) {
        try {
            BigDecimal value = jdbcTemplate.queryForObject(sql, BigDecimal.class, args);
            return value == null ? fallback : value;
        } catch (DataAccessException ex) {
            log.warn("Staff dashboard query failed: {}", ex.getMessage());
            return fallback;
        }
    }
}
