package com.example.shop.modules.supplier.dashboard.service;

import com.example.shop.modules.supplier.dashboard.dto.SupplierDashboardResponse;
import com.example.shop.modules.supplier.finance.entity.SupplierBalance;
import com.example.shop.modules.supplier.finance.repository.SupplierBalanceRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.Collections;
import java.util.List;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class SupplierDashboardServiceImpl implements SupplierDashboardService {

    private final JdbcTemplate jdbcTemplate;
    private final SupplierBalanceRepository supplierBalanceRepository;

    @Override
    public SupplierDashboardResponse getDashboard(UUID supplierUserId, int days, int lowStockThreshold) {
        int safeDays = Math.max(1, Math.min(days, 365));
        int safeThreshold = Math.max(1, lowStockThreshold);
        String supplierId = supplierUserId.toString();

        long totalOrders = countSupplierOrders(supplierId);
        long cancelledOrders = countSupplierCancelledOrders(supplierId);
        double cancelRate = totalOrders == 0 ? 0.0 : round2((double) cancelledOrders / totalOrders * 100);

        BigDecimal totalRevenue = querySupplierRevenue(supplierId);
        long totalProducts = countSupplierProducts(supplierId);
        long lowStockCount = countLowStockProducts(supplierId, safeThreshold);

        SupplierBalance balance = supplierBalanceRepository.findBySupplierUserId(supplierUserId).orElse(null);
        BigDecimal availableBalance = balance == null ? BigDecimal.ZERO : orZero(balance.getAvailableBalance());
        BigDecimal pendingBalance = balance == null ? BigDecimal.ZERO : orZero(balance.getPendingBalance());

        List<SupplierDashboardResponse.RevenuePoint> revenueByDay = queryRevenueByDay(supplierId, safeDays);
        List<SupplierDashboardResponse.TopProductPoint> topProducts = queryTopSellingProducts(supplierId, 10);

        return SupplierDashboardResponse.builder()
                .totalRevenue(orZero(totalRevenue))
                .totalOrders(totalOrders)
                .cancelledOrders(cancelledOrders)
                .cancelRate(cancelRate)
                .totalProducts(totalProducts)
                .lowStockCount(lowStockCount)
                .availableBalance(availableBalance)
                .pendingBalance(pendingBalance)
                .revenueByDay(revenueByDay)
                .topSellingProducts(topProducts)
                .build();
    }

    // ── Queries ──────────────────────────────────────────────────────────────────

    private long countSupplierOrders(String supplierId) {
        try {
            Long val = jdbcTemplate.queryForObject(
                    """
                    SELECT COUNT(DISTINCT o.id)
                    FROM orders o
                    INNER JOIN order_items oi ON oi.order_id = o.id
                    INNER JOIN products p ON p.product_id = oi.product_id
                    WHERE p.supplier_user_id = ?
                    """,
                    Long.class, supplierId);
            return val == null ? 0L : val;
        } catch (DataAccessException e) {
            log.warn("Supplier dashboard: failed to count orders for supplier {}", supplierId, e);
            return 0L;
        }
    }

    private long countSupplierCancelledOrders(String supplierId) {
        try {
            Long val = jdbcTemplate.queryForObject(
                    """
                    SELECT COUNT(DISTINCT o.id)
                    FROM orders o
                    INNER JOIN order_items oi ON oi.order_id = o.id
                    INNER JOIN products p ON p.product_id = oi.product_id
                    WHERE p.supplier_user_id = ?
                      AND LOWER(o.order_status) = 'cancelled'
                    """,
                    Long.class, supplierId);
            return val == null ? 0L : val;
        } catch (DataAccessException e) {
            log.warn("Supplier dashboard: failed to count cancelled orders for supplier {}", supplierId, e);
            return 0L;
        }
    }

    private BigDecimal querySupplierRevenue(String supplierId) {
        try {
            BigDecimal val = jdbcTemplate.queryForObject(
                    """
                    SELECT COALESCE(SUM(oi.line_total), 0)
                    FROM order_items oi
                    INNER JOIN orders o ON o.id = oi.order_id
                    INNER JOIN products p ON p.product_id = oi.product_id
                    WHERE p.supplier_user_id = ?
                      AND o.payment_status IN ('paid', 'authorized')
                    """,
                    BigDecimal.class, supplierId);
            return orZero(val);
        } catch (DataAccessException e) {
            log.warn("Supplier dashboard: failed to query revenue for supplier {}", supplierId, e);
            return BigDecimal.ZERO;
        }
    }

    private long countSupplierProducts(String supplierId) {
        try {
            Long val = jdbcTemplate.queryForObject(
                    "SELECT COUNT(*) FROM products WHERE supplier_user_id = ?",
                    Long.class, supplierId);
            return val == null ? 0L : val;
        } catch (DataAccessException e) {
            log.warn("Supplier dashboard: failed to count products for supplier {}", supplierId, e);
            return 0L;
        }
    }

    private long countLowStockProducts(String supplierId, int threshold) {
        try {
            Long val = jdbcTemplate.queryForObject(
                    """
                    SELECT COUNT(*) FROM products
                    WHERE supplier_user_id = ?
                      AND active = true
                      AND COALESCE(stock_quantity, 0) <= ?
                    """,
                    Long.class, supplierId, threshold);
            return val == null ? 0L : val;
        } catch (DataAccessException e) {
            log.warn("Supplier dashboard: failed to count low-stock products for supplier {}", supplierId, e);
            return 0L;
        }
    }

    private List<SupplierDashboardResponse.RevenuePoint> queryRevenueByDay(String supplierId, int days) {
        try {
            return jdbcTemplate.query(
                    """
                    SELECT
                        TO_CHAR(DATE(o.created_at), 'YYYY-MM-DD') AS day,
                        COUNT(DISTINCT o.id) AS orders,
                        COALESCE(SUM(oi.line_total), 0) AS revenue
                    FROM order_items oi
                    INNER JOIN orders o ON o.id = oi.order_id
                    INNER JOIN products p ON p.product_id = oi.product_id
                    WHERE p.supplier_user_id = ?
                      AND o.payment_status IN ('paid', 'authorized')
                      AND DATE(o.created_at) >= CURRENT_DATE - (? - 1)
                    GROUP BY DATE(o.created_at)
                    ORDER BY DATE(o.created_at) ASC
                    """,
                    (rs, rowNum) -> SupplierDashboardResponse.RevenuePoint.builder()
                            .day(rs.getString("day"))
                            .orders(rs.getLong("orders"))
                            .revenue(orZero(rs.getBigDecimal("revenue")))
                            .build(),
                    supplierId, days
            );
        } catch (DataAccessException e) {
            log.warn("Supplier dashboard: revenue by day query failed for supplier {}", supplierId, e);
            return Collections.emptyList();
        }
    }

    private List<SupplierDashboardResponse.TopProductPoint> queryTopSellingProducts(String supplierId, int limit) {
        try {
            return jdbcTemplate.query(
                    """
                    SELECT
                        oi.product_id,
                        MAX(oi.product_name) AS product_name,
                        COALESCE(SUM(oi.quantity), 0) AS sold_qty,
                        COALESCE(SUM(oi.line_total), 0) AS revenue
                    FROM order_items oi
                    INNER JOIN orders o ON o.id = oi.order_id
                    INNER JOIN products p ON p.product_id = oi.product_id
                    WHERE p.supplier_user_id = ?
                      AND LOWER(o.order_status) <> 'cancelled'
                    GROUP BY oi.product_id
                    ORDER BY sold_qty DESC, oi.product_id ASC
                    LIMIT ?
                    """,
                    (rs, rowNum) -> SupplierDashboardResponse.TopProductPoint.builder()
                            .productId(rs.getString("product_id"))
                            .productName(rs.getString("product_name"))
                            .soldQty(rs.getLong("sold_qty"))
                            .revenue(orZero(rs.getBigDecimal("revenue")))
                            .build(),
                    supplierId, limit
            );
        } catch (DataAccessException e) {
            log.warn("Supplier dashboard: top products query failed for supplier {}", supplierId, e);
            return Collections.emptyList();
        }
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private BigDecimal orZero(BigDecimal value) {
        return value == null ? BigDecimal.ZERO : value;
    }

    private double round2(double value) {
        return Math.round(value * 100.0) / 100.0;
    }
}
