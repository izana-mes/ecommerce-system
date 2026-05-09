package com.example.shop.modules.supplier.dashboard.service;

import com.example.shop.modules.supplier.dashboard.dto.SupplierDashboardResponse;
import com.example.shop.modules.supplier.finance.entity.SupplierBalance;
import com.example.shop.modules.supplier.finance.repository.SupplierBalanceRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.sql.Timestamp;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Collections;
import java.util.List;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
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
        long outOfStockCount = countOutOfStockProducts(supplierId);
        double avgStockPerProduct = queryAvgStockPerProduct(supplierId);

        SupplierBalance balance = supplierBalanceRepository.findBySupplierUserId(supplierUserId).orElse(null);
        BigDecimal availableBalance = balance == null ? BigDecimal.ZERO : orZero(balance.getAvailableBalance());
        BigDecimal pendingBalance = balance == null ? BigDecimal.ZERO : orZero(balance.getPendingBalance());

        List<SupplierDashboardResponse.RevenuePoint> revenueByDay = queryRevenueByDay(supplierId, safeDays);
        List<SupplierDashboardResponse.TopProductPoint> topProducts = queryTopSellingProducts(supplierId, 10);
        List<SupplierDashboardResponse.RestockSuggestionPoint> restockSuggestions =
                queryRestockSuggestions(supplierId, safeThreshold, 8);

        return SupplierDashboardResponse.builder()
                .totalRevenue(orZero(totalRevenue))
                .totalOrders(totalOrders)
                .cancelledOrders(cancelledOrders)
                .cancelRate(cancelRate)
                .totalProducts(totalProducts)
                .lowStockCount(lowStockCount)
                .outOfStockCount(outOfStockCount)
                .avgStockPerProduct(avgStockPerProduct)
                .availableBalance(availableBalance)
                .pendingBalance(pendingBalance)
                .revenueByDay(revenueByDay)
                .topSellingProducts(topProducts)
                .restockSuggestions(restockSuggestions)
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

    private long countOutOfStockProducts(String supplierId) {
        try {
            Long val = jdbcTemplate.queryForObject(
                    """
                    SELECT COUNT(*) FROM products
                    WHERE supplier_user_id = ?
                      AND active = true
                      AND COALESCE(stock_quantity, 0) = 0
                    """,
                    Long.class, supplierId);
            return val == null ? 0L : val;
        } catch (DataAccessException e) {
            log.warn("Supplier dashboard: failed to count out-of-stock products for supplier {}", supplierId, e);
            return 0L;
        }
    }

    private double queryAvgStockPerProduct(String supplierId) {
        try {
            Double val = jdbcTemplate.queryForObject(
                    """
                    SELECT COALESCE(AVG(COALESCE(stock_quantity, 0)), 0)
                    FROM products
                    WHERE supplier_user_id = ?
                      AND active = true
                    """,
                    Double.class, supplierId);
            return val == null ? 0.0 : round2(val);
        } catch (DataAccessException e) {
            log.warn("Supplier dashboard: failed to query avg stock for supplier {}", supplierId, e);
            return 0.0;
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

    private List<SupplierDashboardResponse.RestockSuggestionPoint> queryRestockSuggestions(
            String supplierId,
            int threshold,
            int limit
    ) {
        Timestamp soldSince = Timestamp.from(Instant.now().minus(30, ChronoUnit.DAYS));
        try {
            return jdbcTemplate.query(
                    """
                    SELECT
                        p.product_id,
                        p.product_name,
                        COALESCE(p.stock_quantity, 0) AS stock_qty,
                        COALESCE(SUM(CASE
                            WHEN o.created_at >= ?
                                 AND LOWER(o.order_status) <> 'cancelled'
                            THEN oi.quantity ELSE 0 END), 0) AS sold_30d
                    FROM products p
                    LEFT JOIN order_items oi ON oi.product_id = p.product_id
                    LEFT JOIN orders o ON o.id = oi.order_id
                    WHERE p.supplier_user_id = ?
                      AND p.active = true
                      AND COALESCE(p.stock_quantity, 0) <= ?
                    GROUP BY p.product_id, p.product_name, p.stock_quantity
                    ORDER BY sold_30d DESC, stock_qty ASC, p.product_id ASC
                    LIMIT ?
                    """,
                    (rs, rowNum) -> {
                        int stock = rs.getInt("stock_qty");
                        long sold30d = rs.getLong("sold_30d");
                        double avgDailySold = sold30d <= 0 ? 0.0 : (double) sold30d / 30.0;
                        double daysOfCover = avgDailySold <= 0 ? 999.0 : round2(stock / avgDailySold);

                        return SupplierDashboardResponse.RestockSuggestionPoint.builder()
                                .productId(rs.getString("product_id"))
                                .productName(rs.getString("product_name"))
                                .stockQuantity(stock)
                                .soldLast30Days(sold30d)
                                .daysOfCover(daysOfCover)
                                .urgency(calculateUrgency(stock, daysOfCover))
                                .build();
                    },
                    soldSince, supplierId, threshold, limit
            );
        } catch (DataAccessException e) {
            log.warn("Supplier dashboard: restock suggestions query failed for supplier {}", supplierId, e);
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

    private String calculateUrgency(int stock, double daysOfCover) {
        if (stock <= 0) {
            return "critical";
        }
        if (daysOfCover <= 7) {
            return "high";
        }
        if (daysOfCover <= 14) {
            return "medium";
        }
        return "watch";
    }
}
