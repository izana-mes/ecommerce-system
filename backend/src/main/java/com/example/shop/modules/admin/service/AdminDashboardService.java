package com.example.shop.modules.admin.service;

import com.example.shop.config.RedisCacheConfig;
import com.example.shop.modules.admin.dto.AdminDashboardResponse;
import com.example.shop.modules.review.dto.AdminProductReviewItemDto;
import com.example.shop.modules.review.dto.AdminProductReviewPageDto;
import com.example.shop.modules.review.service.ProductReviewService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.dao.DataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Slf4j
@Service
@RequiredArgsConstructor
public class AdminDashboardService {

    private static final DateTimeFormatter TIMESTAMP_FORMATTER = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");
    private static final int REVIEW_ANALYTICS_PAGE_SIZE = 100;
    private static final int REVIEW_ANALYTICS_MAX_PAGES = 200;

    private final JdbcTemplate jdbcTemplate;
    private final ProductReviewService productReviewService;

    @Transactional(readOnly = true)
    @Cacheable(
            cacheNames = RedisCacheConfig.ADMIN_DASHBOARD,
            key = "T(java.lang.Math).max(1, T(java.lang.Math).min(#days, 90))"
                    + " + '::' + T(java.lang.Math).max(1, T(java.lang.Math).min(#recentLimit, 20))"
                    + " + '::' + T(java.lang.Math).max(1, #lowStockThreshold)"
    )
    public AdminDashboardResponse getDashboard(int days, int recentLimit, int lowStockThreshold) {
        int safeDays = Math.max(1, Math.min(days, 90));
        int safeRecentLimit = Math.max(1, Math.min(recentLimit, 20));
        int safeLowStockThreshold = Math.max(1, lowStockThreshold);

        long totalUsers = queryLong("SELECT COUNT(*) FROM users", 0L);
        long activeUsers = queryLong("SELECT COUNT(*) FROM users WHERE is_active = true", 0L);
        long totalProducts = queryLong("SELECT COUNT(*) FROM products", 0L);
        long activeProducts = queryLong("SELECT COUNT(*) FROM products WHERE active = true", 0L);

        long totalOrders = queryLong("SELECT COUNT(*) FROM orders", 0L);
        BigDecimal totalRevenue = queryBigDecimal(
                "SELECT COALESCE(SUM(total_amount), 0) FROM orders WHERE payment_status IN ('paid', 'authorized')",
                BigDecimal.ZERO
        );
        long pendingOrders = queryLong(
                "SELECT COUNT(*) FROM orders WHERE order_status IN ('pending', 'processing')",
                0L
        );
        long lowStockProducts = queryLong(
                "SELECT COUNT(*) FROM products WHERE active = true AND COALESCE(stock_quantity, 0) <= ?",
                0L,
                safeLowStockThreshold
        );
        long totalWishlistItems = queryLong("SELECT COUNT(*) FROM wishlist_items", 0L);
        long uniqueWishlistUsers = queryLong(
                "SELECT COUNT(DISTINCT user_id) FROM wishlist_items WHERE user_id IS NOT NULL",
                0L
        );
        BigDecimal averageWishlistSize = queryBigDecimal(
                """
                SELECT COALESCE(AVG(item_count), 0)
                FROM (
                    SELECT COUNT(*) AS item_count
                    FROM wishlist_items
                    GROUP BY user_id
                ) wishlist_per_user
                """,
                BigDecimal.ZERO
        );

        List<AdminDashboardResponse.RevenuePoint> revenueByDay = queryRevenueByDay(safeDays);
        List<AdminDashboardResponse.OrderStatusPoint> ordersByStatus = queryOrdersByStatus();
        List<AdminDashboardResponse.RecentOrder> recentOrders = queryRecentOrders(safeRecentLimit);
        List<AdminDashboardResponse.WishlistTrendPoint> wishlistAddsByDay = queryWishlistAddsByDay(safeDays);
        List<AdminDashboardResponse.WishlistProductPoint> topWishlistedProducts = queryTopWishlistedProducts(8);
        List<AdminDashboardResponse.SoldProductPoint> topSoldProducts = queryTopSoldProducts(10);
        AdminDashboardResponse.RatingAnalysis ratingAnalysis = buildRatingAnalysis();

        return new AdminDashboardResponse(
                totalUsers,
                activeUsers,
                totalProducts,
                activeProducts,
                totalOrders,
                totalRevenue,
                pendingOrders,
                lowStockProducts,
                totalWishlistItems,
                uniqueWishlistUsers,
                averageWishlistSize,
                wishlistAddsByDay,
                topWishlistedProducts,
                topSoldProducts,
                ratingAnalysis,
                revenueByDay,
                ordersByStatus,
                recentOrders
        );
    }

    private List<AdminDashboardResponse.WishlistTrendPoint> queryWishlistAddsByDay(int days) {
        try {
            return jdbcTemplate.query(
                    """
                    SELECT
                        TO_CHAR(DATE(created_at), 'YYYY-MM-DD') AS day,
                        COUNT(*) AS adds
                    FROM wishlist_items
                    WHERE DATE(created_at) >= CURRENT_DATE - (? - 1)
                    GROUP BY DATE(created_at)
                    ORDER BY DATE(created_at) ASC
                    """,
                    (rs, rowNum) -> new AdminDashboardResponse.WishlistTrendPoint(
                            rs.getString("day"),
                            rs.getLong("adds")
                    ),
                    days
            );
        } catch (DataAccessException ex) {
            log.warn("Admin dashboard wishlist trend query failed, fallback to empty list: {}", ex.getMessage());
            return Collections.emptyList();
        }
    }

    private List<AdminDashboardResponse.WishlistProductPoint> queryTopWishlistedProducts(int limit) {
        try {
            return jdbcTemplate.query(
                    """
                    SELECT
                        product_id,
                        MAX(product_name) AS product_name,
                        COUNT(*) AS wishlists
                    FROM wishlist_items
                    GROUP BY product_id
                    ORDER BY wishlists DESC, product_id ASC
                    LIMIT ?
                    """,
                    (rs, rowNum) -> new AdminDashboardResponse.WishlistProductPoint(
                            rs.getString("product_id"),
                            rs.getString("product_name"),
                            rs.getLong("wishlists")
                    ),
                    limit
            );
        } catch (DataAccessException ex) {
            log.warn("Admin dashboard top wishlist products query failed, fallback to empty list: {}", ex.getMessage());
            return Collections.emptyList();
        }
    }

    private List<AdminDashboardResponse.RevenuePoint> queryRevenueByDay(int days) {
        try {
            return jdbcTemplate.query(
                    """
                    SELECT
                        TO_CHAR(DATE(created_at), 'YYYY-MM-DD') AS day,
                        COUNT(*) AS orders,
                        COALESCE(SUM(total_amount), 0) AS revenue
                    FROM orders
                    WHERE DATE(created_at) >= CURRENT_DATE - (? - 1)
                    GROUP BY DATE(created_at)
                    ORDER BY DATE(created_at) ASC
                    """,
                    (rs, rowNum) -> new AdminDashboardResponse.RevenuePoint(
                            rs.getString("day"),
                            rs.getLong("orders"),
                            valueOrZero(rs.getBigDecimal("revenue"))
                    ),
                    days
            );
        } catch (DataAccessException ex) {
            log.warn("Admin dashboard revenue query failed, fallback to empty list: {}", ex.getMessage());
            return Collections.emptyList();
        }
    }

    private List<AdminDashboardResponse.SoldProductPoint> queryTopSoldProducts(int limit) {
        try {
            return jdbcTemplate.query(
                    """
                    SELECT
                        oi.product_id,
                        MAX(oi.product_name) AS product_name,
                        COALESCE(SUM(oi.quantity), 0) AS sold_qty
                    FROM order_items oi
                    INNER JOIN orders o ON o.id = oi.order_id
                    WHERE o.order_status <> 'cancelled'
                    GROUP BY oi.product_id
                    ORDER BY sold_qty DESC, oi.product_id ASC
                    LIMIT ?
                    """,
                    (rs, rowNum) -> new AdminDashboardResponse.SoldProductPoint(
                            rs.getString("product_id"),
                            rs.getString("product_name"),
                            rs.getLong("sold_qty")
                    ),
                    limit
            );
        } catch (DataAccessException ex) {
            log.warn("Admin dashboard top sold products query failed, fallback to empty list: {}", ex.getMessage());
            return Collections.emptyList();
        }
    }

    private AdminDashboardResponse.RatingAnalysis buildRatingAnalysis() {
        List<AdminProductReviewItemDto> allReviews = readAllReviewsForAnalytics();
        if (allReviews.isEmpty()) {
            return new AdminDashboardResponse.RatingAnalysis(
                    0L,
                    0.0,
                    0L,
                    0L,
                    List.of(
                            new AdminDashboardResponse.RatingDistributionPoint(1, 0L),
                            new AdminDashboardResponse.RatingDistributionPoint(2, 0L),
                            new AdminDashboardResponse.RatingDistributionPoint(3, 0L),
                            new AdminDashboardResponse.RatingDistributionPoint(4, 0L),
                            new AdminDashboardResponse.RatingDistributionPoint(5, 0L)
                    ),
                    List.of(),
                    List.of()
            );
        }

        long[] distribution = new long[6];
        long lowRatingCount = 0L;
        long highRatingCount = 0L;
        long ratingSum = 0L;
        long ratingCount = 0L;
        Map<String, ProductRatingAccumulator> productRatings = new HashMap<>();

        for (AdminProductReviewItemDto review : allReviews) {
            if (review == null || review.getRating() == null) {
                continue;
            }
            int rating = Math.max(1, Math.min(5, review.getRating()));
            distribution[rating] += 1;
            ratingSum += rating;
            ratingCount += 1;
            if (rating <= 2) {
                lowRatingCount += 1;
            }
            if (rating >= 4) {
                highRatingCount += 1;
            }

            String productID = review.getProductID() == null ? "" : review.getProductID().trim();
            if (productID.isEmpty()) {
                continue;
            }
            ProductRatingAccumulator acc = productRatings.computeIfAbsent(productID, key -> new ProductRatingAccumulator());
            acc.reviewCount += 1;
            acc.ratingSum += rating;
            if (rating <= 2) {
                acc.lowRatingCount += 1;
            }
        }

        Map<String, String> productNamesById = queryProductNames();
        List<AdminDashboardResponse.RatingProductPoint> productPoints = productRatings.entrySet().stream()
                .map(entry -> {
                    String productID = entry.getKey();
                    ProductRatingAccumulator acc = entry.getValue();
                    double averageRating = acc.reviewCount == 0 ? 0.0 : (double) acc.ratingSum / acc.reviewCount;
                    return new AdminDashboardResponse.RatingProductPoint(
                            productID,
                            productNamesById.getOrDefault(productID, productID),
                            acc.reviewCount,
                            round2(averageRating),
                            acc.lowRatingCount
                    );
                })
                .toList();

        List<AdminDashboardResponse.RatingProductPoint> topReviewedProducts = productPoints.stream()
                .sorted((a, b) -> {
                    int byCount = Long.compare(b.reviewCount(), a.reviewCount());
                    if (byCount != 0) {
                        return byCount;
                    }
                    return Double.compare(b.averageRating(), a.averageRating());
                })
                .limit(10)
                .toList();

        List<AdminDashboardResponse.RatingProductPoint> lowestRatedProducts = productPoints.stream()
                .filter(item -> item.reviewCount() > 0)
                .sorted((a, b) -> {
                    int byAvg = Double.compare(a.averageRating(), b.averageRating());
                    if (byAvg != 0) {
                        return byAvg;
                    }
                    return Long.compare(b.reviewCount(), a.reviewCount());
                })
                .limit(10)
                .toList();

        List<AdminDashboardResponse.RatingDistributionPoint> distributionPoints = List.of(
                new AdminDashboardResponse.RatingDistributionPoint(1, distribution[1]),
                new AdminDashboardResponse.RatingDistributionPoint(2, distribution[2]),
                new AdminDashboardResponse.RatingDistributionPoint(3, distribution[3]),
                new AdminDashboardResponse.RatingDistributionPoint(4, distribution[4]),
                new AdminDashboardResponse.RatingDistributionPoint(5, distribution[5])
        );

        return new AdminDashboardResponse.RatingAnalysis(
                ratingCount,
                ratingCount == 0 ? 0.0 : round2((double) ratingSum / ratingCount),
                lowRatingCount,
                highRatingCount,
                distributionPoints,
                topReviewedProducts,
                lowestRatedProducts
        );
    }

    private List<AdminProductReviewItemDto> readAllReviewsForAnalytics() {
        List<AdminProductReviewItemDto> reviews = new ArrayList<>();
        for (int page = 0; page < REVIEW_ANALYTICS_MAX_PAGES; page++) {
            AdminProductReviewPageDto result = productReviewService.getReviewsForAdmin(null, page, REVIEW_ANALYTICS_PAGE_SIZE);
            if (result == null || result.getContent() == null || result.getContent().isEmpty()) {
                break;
            }
            reviews.addAll(result.getContent());
            if (page + 1 >= result.getTotalPages()) {
                break;
            }
        }
        return reviews;
    }

    private Map<String, String> queryProductNames() {
        try {
            return jdbcTemplate.query(
                    "SELECT product_id, product_name FROM products",
                    rs -> {
                        Map<String, String> map = new HashMap<>();
                        while (rs.next()) {
                            map.put(rs.getString("product_id"), rs.getString("product_name"));
                        }
                        return map;
                    }
            );
        } catch (DataAccessException ex) {
            log.warn("Admin dashboard product names query failed, fallback to productID: {}", ex.getMessage());
            return Map.of();
        }
    }

    private double round2(double value) {
        return Math.round(value * 100.0) / 100.0;
    }

    private static class ProductRatingAccumulator {
        long reviewCount;
        long ratingSum;
        long lowRatingCount;
    }

    private List<AdminDashboardResponse.OrderStatusPoint> queryOrdersByStatus() {
        try {
            return jdbcTemplate.query(
                    """
                    SELECT order_status, COUNT(*) AS total
                    FROM orders
                    GROUP BY order_status
                    ORDER BY total DESC
                    """,
                    (rs, rowNum) -> new AdminDashboardResponse.OrderStatusPoint(
                            rs.getString("order_status"),
                            rs.getLong("total")
                    )
            );
        } catch (DataAccessException ex) {
            log.warn("Admin dashboard status breakdown query failed, fallback to empty list: {}", ex.getMessage());
            return Collections.emptyList();
        }
    }

    private List<AdminDashboardResponse.RecentOrder> queryRecentOrders(int recentLimit) {
        try {
            return jdbcTemplate.query(
                    """
                    SELECT
                        id,
                        order_number,
                        customer_email,
                        customer_first_name,
                        customer_last_name,
                        total_amount,
                        currency,
                        payment_status,
                        order_status,
                        created_at
                    FROM orders
                    ORDER BY created_at DESC
                    LIMIT ?
                    """,
                    (rs, rowNum) -> {
                        String firstName = rs.getString("customer_first_name");
                        String lastName = rs.getString("customer_last_name");
                        String customerName = String.format("%s %s",
                                        firstName == null ? "" : firstName,
                                        lastName == null ? "" : lastName)
                                .trim();

                        LocalDateTime createdAt = rs.getTimestamp("created_at") == null
                                ? null
                                : rs.getTimestamp("created_at").toLocalDateTime();

                        return new AdminDashboardResponse.RecentOrder(
                                rs.getLong("id"),
                                rs.getString("order_number"),
                                rs.getString("customer_email"),
                                customerName,
                                valueOrZero(rs.getBigDecimal("total_amount")),
                                rs.getString("currency"),
                                rs.getString("payment_status"),
                                rs.getString("order_status"),
                                createdAt == null ? "" : createdAt.format(TIMESTAMP_FORMATTER)
                        );
                    },
                    recentLimit
            );
        } catch (DataAccessException ex) {
            log.warn("Admin dashboard recent orders query failed, fallback to empty list: {}", ex.getMessage());
            return Collections.emptyList();
        }
    }

    private long queryLong(String sql, long fallback, Object... args) {
        try {
            Long value = jdbcTemplate.queryForObject(sql, Long.class, args);
            return value == null ? fallback : value;
        } catch (DataAccessException ex) {
            log.warn("Admin dashboard long query failed: {} | sql={}", ex.getMessage(), sql);
            return fallback;
        }
    }

    private BigDecimal queryBigDecimal(String sql, BigDecimal fallback, Object... args) {
        try {
            BigDecimal value = jdbcTemplate.queryForObject(sql, BigDecimal.class, args);
            return value == null ? fallback : value;
        } catch (DataAccessException ex) {
            log.warn("Admin dashboard decimal query failed: {} | sql={}", ex.getMessage(), sql);
            return fallback;
        }
    }

    private BigDecimal valueOrZero(BigDecimal value) {
        return value == null ? BigDecimal.ZERO : value;
    }
}
