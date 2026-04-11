package com.example.shop.modules.admin.dto;

import java.math.BigDecimal;
import java.io.Serializable;
import java.util.List;

public record AdminDashboardResponse(
        long totalUsers,
        long activeUsers,
        long totalProducts,
        long activeProducts,
        long totalOrders,
        BigDecimal totalRevenue,
        long pendingOrders,
        long lowStockProducts,
        long totalWishlistItems,
        long uniqueWishlistUsers,
        BigDecimal averageWishlistSize,
        List<WishlistTrendPoint> wishlistAddsByDay,
        List<WishlistProductPoint> topWishlistedProducts,
        List<SoldProductPoint> topSoldProducts,
        RatingAnalysis ratingAnalysis,
        List<RevenuePoint> revenueByDay,
        List<OrderStatusPoint> ordersByStatus,
        List<RecentOrder> recentOrders
) implements Serializable {
    public record WishlistTrendPoint(
            String day,
            long adds
    ) implements Serializable {
    }

    public record WishlistProductPoint(
            String productID,
            String productName,
            long wishlists
    ) implements Serializable {
    }

    public record RevenuePoint(
            String day,
            long orders,
            BigDecimal revenue
    ) implements Serializable {
    }

    public record SoldProductPoint(
            String productID,
            String productName,
            long soldQty
    ) implements Serializable {
    }

    public record RatingAnalysis(
            long totalReviews,
            double averageRating,
            long lowRatingCount,
            long highRatingCount,
            List<RatingDistributionPoint> distribution,
            List<RatingProductPoint> topReviewedProducts,
            List<RatingProductPoint> lowestRatedProducts
    ) implements Serializable {
    }

    public record RatingDistributionPoint(
            int rating,
            long count
    ) implements Serializable {
    }

    public record RatingProductPoint(
            String productID,
            String productName,
            long reviewCount,
            double averageRating,
            long lowRatingCount
    ) implements Serializable {
    }

    public record OrderStatusPoint(
            String status,
            long count
    ) implements Serializable {
    }

    public record RecentOrder(
            long id,
            String orderNumber,
            String customerEmail,
            String customerName,
            BigDecimal totalAmount,
            String currency,
            String paymentStatus,
            String orderStatus,
            String createdAt
    ) implements Serializable {
    }
}
