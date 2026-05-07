package com.example.shop.modules.seller.order.service;

import com.example.shop.modules.seller.order.dto.SellerOrderDto;

import java.util.List;
import java.util.UUID;

/**
 * Seller-scoped order query operations.
 * All methods are read-only and automatically scope results to
 * products owned by the given seller.
 */
public interface SellerOrderService {

    /**
     * Lists orders that contain at least one product owned by this seller.
     *
     * @param sellerUserId the authenticated seller's user ID
     * @param limit        max rows to return (capped internally at 500)
     * @param status       optional order-status filter (e.g. "PENDING", "DELIVERED").
     *                     Pass {@code null} or blank to return all statuses.
     * @return list of matching order line-items, newest first
     */
    List<SellerOrderDto> listOrdersForSeller(UUID sellerUserId, int limit, String status);
}
