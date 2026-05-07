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

@RestController
@RequestMapping("/api/v1/seller/orders")
@RequiredArgsConstructor
public class SellerOrderController {

    private final SellerOrderService sellerOrderService;

    @GetMapping
    @PreAuthorize("hasRole('SELLER')")
    public ResponseEntity<ApiResponse<List<SellerOrderDto>>> getSellerOrders(
            @AuthenticationPrincipal User user,
            @RequestParam(defaultValue = "100") int limit
    ) {
        return ResponseEntity.ok(ApiResponse.success(sellerOrderService.listOrdersForSeller(user.getId(), limit)));
    }
}
