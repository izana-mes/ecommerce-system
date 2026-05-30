package com.example.shop.modules.dashboard.service;

import com.example.shop.modules.dashboard.dto.DashboardStatsResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;

/**
 * Service implementation for compiling dashboard statistics from database.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class DashboardStatsServiceImpl implements DashboardStatsService {

    private final JdbcTemplate jdbcTemplate;

    @Override
    @Transactional(readOnly = true)
    public DashboardStatsResponse getStats() {
        log.debug("Fetching real-time statistics from database");

        long totalProducts = queryCount("SELECT COUNT(*) FROM products");

        long totalCustomers = queryCount(
            "SELECT COUNT(DISTINCT u.users_id) FROM users u "
            + "JOIN user_roles ur ON u.users_id = ur.users_id "
            + "JOIN roles r ON ur.roles_id = r.roles_id "
            + "WHERE r.roles_name = 'ROLE_USER'"
        );

        long totalSuppliers = queryCount(
            "SELECT COUNT(DISTINCT u.users_id) FROM users u "
            + "JOIN user_roles ur ON u.users_id = ur.users_id "
            + "JOIN roles r ON ur.roles_id = r.roles_id "
            + "WHERE r.roles_name = 'ROLE_SUPPLIER'"
        );

        long totalOrders = queryCount("SELECT COUNT(*) FROM orders");

        double revenue = queryRevenue(
            "SELECT COALESCE(SUM(total_amount), 0) FROM orders "
            + "WHERE payment_status IN ('paid', 'authorized')"
        );

        long totalEmployees = queryCount(
            "SELECT COUNT(DISTINCT u.users_id) FROM users u "
            + "JOIN user_roles ur ON u.users_id = ur.users_id "
            + "JOIN roles r ON ur.roles_id = r.roles_id "
            + "WHERE r.roles_name IN ('ROLE_EMPLOYEE', 'ROLE_ADMIN')"
        );

        long totalWarehouses = queryCount("SELECT COUNT(*) FROM warehouses");

        long trustedPartners = queryCount("SELECT COUNT(*) FROM trusted_partners");

        return new DashboardStatsResponse(
            totalProducts,
            totalCustomers,
            totalSuppliers,
            totalOrders,
            revenue,
            totalEmployees,
            totalWarehouses,
            trustedPartners
        );
    }

    private long queryCount(String sql) {
        Long val = jdbcTemplate.queryForObject(sql, Long.class);
        return val != null ? val : 0L;
    }

    private double queryRevenue(String sql) {
        BigDecimal val = jdbcTemplate.queryForObject(sql, BigDecimal.class);
        return val != null ? val.doubleValue() : 0.0;
    }
}
