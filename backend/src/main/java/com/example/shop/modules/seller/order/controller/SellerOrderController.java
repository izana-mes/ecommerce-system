package com.example.shop.modules.seller.order.controller;

import com.example.shop.common.response.ApiResponse;
import com.example.shop.modules.seller.order.dto.SellerOrderDto;
import com.example.shop.modules.seller.order.service.SellerOrderService;
import com.example.shop.modules.user.entity.User;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * REST controller for seller-scoped order queries.
 *
 * <p>All endpoints require the {@code SELLER} role. Results are automatically
 * scoped to products owned by the authenticated seller.
 */
@RestController
@RequestMapping("/api/v1/seller/orders")
@RequiredArgsConstructor
public class SellerOrderController {

    private final SellerOrderService sellerOrderService;

    /**
     * GET /api/v1/seller/orders
     *
     * <p>Returns orders containing the seller's products, newest first.
     *
     * @param limit  max rows (default 100, capped at 500)
     * @param status optional filter – e.g. {@code PENDING}, {@code DELIVERED},
     *               {@code SHIPPED}. Case-insensitive. Omit to return all statuses.
     */
    @GetMapping
    @PreAuthorize("hasRole('SELLER')")
    public ResponseEntity<ApiResponse<List<SellerOrderDto>>> getSellerOrders(
            @AuthenticationPrincipal User user,
            @RequestParam(defaultValue = "100") int limit,
            @RequestParam(required = false) String status
    ) {
        List<SellerOrderDto> orders = sellerOrderService.listOrdersForSeller(
                user.getId(), limit, status);
        return ResponseEntity.ok(ApiResponse.success(orders));
    }
}
