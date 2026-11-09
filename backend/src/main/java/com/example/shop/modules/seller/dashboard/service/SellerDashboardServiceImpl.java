package com.example.shop.modules.seller.dashboard.service;

import com.example.shop.config.RedisCacheConfig;
import com.example.shop.modules.seller.dashboard.dto.SellerDashboardResponse;
import com.example.shop.modules.seller.finance.entity.SellerBalance;
import com.example.shop.modules.seller.finance.repository.SellerBalanceRepository;
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
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class SellerDashboardServiceImpl implements SellerDashboardService {

    private final JdbcTemplate jdbcTemplate;
    private final SellerBalanceRepository sellerBalanceRepository;

    @Override
    @Cacheable(
            cacheNames = RedisCacheConfig.SELLER_DASHBOARD,
            key = "#sellerUserId + '::' + T(java.lang.Math).max(1, T(java.lang.Math).min(#days, 365)) + '::' + T(java.lang.Math).max(1, #lowStockThreshold)"
    )
    public SellerDashboardResponse getDashboard(UUID sellerUserId, int days, int lowStockThreshold) {
        int safeDays = Math.max(1, Math.min(days, 365));
        int safeThreshold = Math.max(1, lowStockThreshold);

        long totalOrders = countSellerOrders(sellerUserId);
        long cancelledOrders = countSellerCancelledOrders(sellerUserId);
        double cancelRate = totalOrders == 0 ? 0.0 : round2((double) cancelledOrders / totalOrders * 100);

        BigDecimal totalRevenue = querySellerRevenue(sellerUserId);
        long totalProducts = countSellerProducts(sellerUserId);
        long activeListings = countActiveSellerListings(sellerUserId);
        long inactiveListings = countInactiveSellerListings(sellerUserId);
        long pendingListings = countPendingSellerListings(sellerUserId);
        long totalAuthorizedProducts = countAuthorizedProducts(sellerUserId);
        long totalAllocatedInventory = queryTotalAllocatedInventory(sellerUserId);
        long remainingInventory = queryRemainingInventory(sellerUserId);
        long outOfStockCount = countOutOfStock(sellerUserId);
        long pendingRequestsCount = countPendingRequests(sellerUserId);
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
                .activeListings(activeListings)
                .pendingListings(pendingListings)
                .inactiveListings(inactiveListings)
                .totalAuthorizedProducts(totalAuthorizedProducts)
                .totalAllocatedInventory(totalAllocatedInventory)
                .remainingInventory(remainingInventory)
                .outOfStockCount(outOfStockCount)
                .pendingRequestsCount(pendingRequestsCount)
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
                    WHERE COALESCE(oi.seller_user_id, p.seller_user_id) = ?
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
                    WHERE COALESCE(oi.seller_user_id, p.seller_user_id) = ?
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
                    WHERE COALESCE(oi.seller_user_id, p.seller_user_id) = ?
                      AND o.payment_status IN ('paid', 'authorized')
                    """,
                    BigDecimal.class, sellerUserId);
            return orZero(val);
        } catch (DataAccessException e) {
            log.warn("Seller dashboard: failed to query revenue for seller {}", sellerUserId, e);
            return BigDecimal.ZERO;
        }
    }

    private long countActiveSellerListings(UUID sellerUserId) {
        try {
            Long val = jdbcTemplate.queryForObject(
                    "SELECT COUNT(*) FROM seller_product_listings WHERE seller_user_id = ? AND active = TRUE",
                    Long.class, sellerUserId);
            return val == null ? 0L : val;
        } catch (DataAccessException e) {
            log.warn("Seller dashboard: failed to count active listings for seller {}", sellerUserId, e);
            return 0L;
        }
    }

    private long countInactiveSellerListings(UUID sellerUserId) {
        try {
            Long val = jdbcTemplate.queryForObject(
                    "SELECT COUNT(*) FROM seller_product_listings WHERE seller_user_id = ? AND (active = FALSE OR active IS NULL)",
                    Long.class, sellerUserId);
            return val == null ? 0L : val;
        } catch (DataAccessException e) {
            log.warn("Seller dashboard: failed to count inactive listings for seller {}", sellerUserId, e);
            return 0L;
        }
    }

    private long countPendingSellerListings(UUID sellerUserId) {
        try {
            Long unlistedAuths = jdbcTemplate.queryForObject(
                    """
                    SELECT COUNT(*) FROM seller_resale_authorizations a
                    WHERE a.seller_user_id = ? AND a.is_active = TRUE
                      AND NOT EXISTS (SELECT 1 FROM seller_product_listings l WHERE l.authorization_id = a.id)
                    """,
                    Long.class, sellerUserId);
            Long pendingChanges = jdbcTemplate.queryForObject(
                    "SELECT COUNT(*) FROM product_change_requests WHERE requested_by_user_id = ? AND status = 'PENDING'",
                    Long.class, sellerUserId);
            return (unlistedAuths == null ? 0L : unlistedAuths) + (pendingChanges == null ? 0L : pendingChanges);
        } catch (DataAccessException e) {
            log.warn("Seller dashboard: failed to count pending listings for seller {}", sellerUserId, e);
            return 0L;
        }
    }

    private long countAuthorizedProducts(UUID sellerUserId) {
        try {
            Long val = jdbcTemplate.queryForObject(
                    "SELECT COUNT(*) FROM seller_resale_authorizations WHERE seller_user_id = ? AND is_active = TRUE",
                    Long.class, sellerUserId);
            return val == null ? 0L : val;
        } catch (DataAccessException e) {
            log.warn("Seller dashboard: failed to count authorized products for seller {}", sellerUserId, e);
            return 0L;
        }
    }

    private long queryTotalAllocatedInventory(UUID sellerUserId) {
        try {
            Long val = jdbcTemplate.queryForObject(
                    "SELECT COALESCE(SUM(allocated_quantity), 0) FROM seller_product_allocations WHERE seller_user_id = ? AND status = 'ACTIVE'",
                    Long.class, sellerUserId);
            return val == null ? 0L : val;
        } catch (DataAccessException e) {
            log.warn("Seller dashboard: failed to query allocated inventory for seller {}", sellerUserId, e);
            return 0L;
        }
    }

    private long queryRemainingInventory(UUID sellerUserId) {
        try {
            Long resaleRemaining = jdbcTemplate.queryForObject(
                    "SELECT COALESCE(SUM(GREATEST(0, allocated_quantity - sold_quantity - reserved_quantity)), 0) FROM seller_product_allocations WHERE seller_user_id = ? AND status = 'ACTIVE'",
                    Long.class, sellerUserId);
            Long ownedStock = jdbcTemplate.queryForObject(
                    "SELECT COALESCE(SUM(GREATEST(0, stock_quantity)), 0) FROM products WHERE seller_user_id = ? AND active = TRUE",
                    Long.class, sellerUserId);
            return (resaleRemaining == null ? 0L : resaleRemaining) + (ownedStock == null ? 0L : ownedStock);
        } catch (DataAccessException e) {
            log.warn("Seller dashboard: failed to query remaining inventory for seller {}", sellerUserId, e);
            return 0L;
        }
    }

    private long countOutOfStock(UUID sellerUserId) {
        try {
            Long resaleOut = jdbcTemplate.queryForObject(
                    "SELECT COUNT(*) FROM seller_product_allocations WHERE seller_user_id = ? AND status = 'ACTIVE' AND allocated_quantity - sold_quantity - reserved_quantity <= 0",
                    Long.class, sellerUserId);
            Long ownedOut = jdbcTemplate.queryForObject(
                    "SELECT COUNT(*) FROM products WHERE seller_user_id = ? AND active = TRUE AND COALESCE(stock_quantity, 0) <= 0",
                    Long.class, sellerUserId);
            return (resaleOut == null ? 0L : resaleOut) + (ownedOut == null ? 0L : ownedOut);
        } catch (DataAccessException e) {
            log.warn("Seller dashboard: failed to count out of stock for seller {}", sellerUserId, e);
            return 0L;
        }
    }

    private long countPendingRequests(UUID sellerUserId) {
        try {
            Long val = jdbcTemplate.queryForObject(
                    "SELECT COUNT(*) FROM seller_resale_requests WHERE seller_user_id = ? AND status = 'PENDING'",
                    Long.class, sellerUserId);
            return val == null ? 0L : val;
        } catch (DataAccessException e) {
            log.warn("Seller dashboard: failed to count pending requests for seller {}", sellerUserId, e);
            return 0L;
        }
    }

    private long countSellerProducts(UUID sellerUserId) {
        try {
            Long val = jdbcTemplate.queryForObject(
                    "SELECT (SELECT COUNT(*) FROM products WHERE seller_user_id = ?) + (SELECT COUNT(*) FROM seller_product_listings WHERE seller_user_id = ? AND active = TRUE)",
                    Long.class, sellerUserId, sellerUserId);
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
                    WHERE COALESCE(oi.seller_user_id, p.seller_user_id) = ?
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
                    WHERE COALESCE(oi.seller_user_id, p.seller_user_id) = ?
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
