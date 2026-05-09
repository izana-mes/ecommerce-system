package com.example.shop.modules.seller.dashboard.service;

import com.example.shop.modules.seller.dashboard.dto.SellerDashboardResponse;
import com.example.shop.modules.seller.finance.entity.SellerBalance;
import com.example.shop.modules.seller.finance.repository.SellerBalanceRepository;
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
public class SellerDashboardServiceImpl implements SellerDashboardService {

    private final JdbcTemplate jdbcTemplate;
    private final SellerBalanceRepository sellerBalanceRepository;

    @Override
    public SellerDashboardResponse getDashboard(UUID sellerUserId, int days, int lowStockThreshold) {
        int safeDays = Math.max(1, Math.min(days, 365));
        int safeThreshold = Math.max(1, lowStockThreshold);

        long totalOrders = countSellerOrders(sellerUserId);
        long cancelledOrders = countSellerCancelledOrders(sellerUserId);
        double cancelRate = totalOrders == 0 ? 0.0 : round2((double) cancelledOrders / totalOrders * 100);

        BigDecimal totalRevenue = querySellerRevenue(sellerUserId);
        long totalProducts = countSellerProducts(sellerUserId);
        long lowStockCount = countLowStockProducts(sellerUserId, safeThreshold);

        SellerBalance balance = sellerBalanceRepository.findBySellerUserId(sellerUserId).orElse(null);
        BigDecimal availableBalance = balance == null ? BigDecimal.ZERO : orZero(balance.getAvailableBalance());
        BigDecimal pendingBalance = balance == null ? BigDecimal.ZERO : orZero(balance.getPendingBalance());

        List<SellerDashboardResponse.RevenuePoint> revenueByDay = queryRevenueByDay(sellerUserId, safeDays);
        List<SellerDashboardResponse.TopProductPoint> topProducts = queryTopSellingProducts(sellerUserId, 10);

        return SellerDashboardResponse.builder()
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

    private long countSellerOrders(UUID sellerUserId) {
        try {
            Long val = jdbcTemplate.queryForObject(
                    """
                    SELECT COUNT(DISTINCT o.id)
                    FROM orders o
                    INNER JOIN order_items oi ON oi.order_id = o.id
                    INNER JOIN products p ON p.product_id = oi.product_id
                    WHERE p.seller_user_id = ?
                    """,
                    Long.class, sellerUserId);
            return val == null ? 0L : val;
        } catch (DataAccessException e) {
            log.warn("Seller dashboard: failed to count orders for seller {}", sellerUserId, e);
            return 0L;
        }
    }

    private long countSellerCancelledOrders(UUID sellerUserId) {
        try {
            Long val = jdbcTemplate.queryForObject(
                    """
                    SELECT COUNT(DISTINCT o.id)
                    FROM orders o
                    INNER JOIN order_items oi ON oi.order_id = o.id
                    INNER JOIN products p ON p.product_id = oi.product_id
                    WHERE p.seller_user_id = ?
                      AND LOWER(o.order_status) = 'cancelled'
                    """,
                    Long.class, sellerUserId);
            return val == null ? 0L : val;
        } catch (DataAccessException e) {
            log.warn("Seller dashboard: failed to count cancelled orders for seller {}", sellerUserId, e);
            return 0L;
        }
    }

    private BigDecimal querySellerRevenue(UUID sellerUserId) {
        try {
            BigDecimal val = jdbcTemplate.queryForObject(
                    """
                    SELECT COALESCE(SUM(oi.line_total), 0)
                    FROM order_items oi
                    INNER JOIN orders o ON o.id = oi.order_id
                    INNER JOIN products p ON p.product_id = oi.product_id
                    WHERE p.seller_user_id = ?
                      AND o.payment_status IN ('paid', 'authorized')
                    """,
                    BigDecimal.class, sellerUserId);
            return orZero(val);
        } catch (DataAccessException e) {
            log.warn("Seller dashboard: failed to query revenue for seller {}", sellerUserId, e);
            return BigDecimal.ZERO;
        }
    }

    private long countSellerProducts(UUID sellerUserId) {
        try {
            Long val = jdbcTemplate.queryForObject(
                    "SELECT COUNT(*) FROM products WHERE seller_user_id = ?",
                    Long.class, sellerUserId);
            return val == null ? 0L : val;
        } catch (DataAccessException e) {
            log.warn("Seller dashboard: failed to count products for seller {}", sellerUserId, e);
            return 0L;
        }
    }

    private long countLowStockProducts(UUID sellerUserId, int threshold) {
        try {
            Long val = jdbcTemplate.queryForObject(
                    """
                    SELECT COUNT(*) FROM products
                    WHERE seller_user_id = ?
                      AND active = true
                      AND COALESCE(stock_quantity, 0) <= ?
                    """,
                    Long.class, sellerUserId, threshold);
            return val == null ? 0L : val;
        } catch (DataAccessException e) {
            log.warn("Seller dashboard: failed to count low-stock products for seller {}", sellerUserId, e);
            return 0L;
        }
    }

    private List<SellerDashboardResponse.RevenuePoint> queryRevenueByDay(UUID sellerUserId, int days) {
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
                    WHERE p.seller_user_id = ?
                      AND o.payment_status IN ('paid', 'authorized')
                      AND DATE(o.created_at) >= CURRENT_DATE - (? - 1)
                    GROUP BY DATE(o.created_at)
                    ORDER BY DATE(o.created_at) ASC
                    """,
                    (rs, rowNum) -> SellerDashboardResponse.RevenuePoint.builder()
                            .day(rs.getString("day"))
                            .orders(rs.getLong("orders"))
                            .revenue(orZero(rs.getBigDecimal("revenue")))
                            .build(),
                    sellerUserId, days
            );
        } catch (DataAccessException e) {
            log.warn("Seller dashboard: revenue by day query failed for seller {}", sellerUserId, e);
            return Collections.emptyList();
        }
    }

    private List<SellerDashboardResponse.TopProductPoint> queryTopSellingProducts(UUID sellerUserId, int limit) {
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
                    WHERE p.seller_user_id = ?
                      AND LOWER(o.order_status) <> 'cancelled'
                    GROUP BY oi.product_id
                    ORDER BY sold_qty DESC, oi.product_id ASC
                    LIMIT ?
                    """,
                    (rs, rowNum) -> SellerDashboardResponse.TopProductPoint.builder()
                            .productId(rs.getString("product_id"))
                            .productName(rs.getString("product_name"))
                            .soldQty(rs.getLong("sold_qty"))
                            .revenue(orZero(rs.getBigDecimal("revenue")))
                            .build(),
                    sellerUserId, limit
            );
        } catch (DataAccessException e) {
            log.warn("Seller dashboard: top products query failed for seller {}", sellerUserId, e);
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
