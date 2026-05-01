package com.example.shop.modules.order.controller;

import com.example.shop.common.response.ApiResponse;
import com.example.shop.modules.order.dto.OrderCreateRequest;
import com.example.shop.modules.order.dto.OrderCreateResponse;
import com.example.shop.modules.order.dto.OrderHistoryItemDto;
import com.example.shop.modules.order.service.OrderService;
import com.example.shop.modules.user.entity.User;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/orders")
@RequiredArgsConstructor
public class OrderController {

    private final OrderService orderService;

    @PostMapping
    public ResponseEntity<ApiResponse<OrderCreateResponse>> createOrder(
            @Valid @RequestBody OrderCreateRequest request,
            @AuthenticationPrincipal User user
    ) {
        OrderCreateResponse response = orderService.createOrder(request, user);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success(response));
    }

    @GetMapping("/history")
    public ResponseEntity<ApiResponse<List<OrderHistoryItemDto>>> getMyOrderHistory(
            @AuthenticationPrincipal User user,
            @RequestParam(value = "limit", required = false, defaultValue = "20") int limit
    ) {
        return ResponseEntity.ok(ApiResponse.success(orderService.getMyOrders(user, limit)));
    }

    @PutMapping("/{orderNumber}")
    public ResponseEntity<ApiResponse<OrderHistoryItemDto>> editOrder(
            @PathVariable String orderNumber,
            @Valid @RequestBody com.example.shop.modules.order.dto.OrderEditRequest request,
            @AuthenticationPrincipal User user
    ) {
        return ResponseEntity.ok(ApiResponse.success(orderService.editOrder(orderNumber, request, user)));
    }

    @PostMapping("/{orderNumber}/cancel")
    public ResponseEntity<ApiResponse<Void>> cancelOrder(
            @PathVariable String orderNumber,
            @AuthenticationPrincipal User user
    ) {
        orderService.cancelOrder(orderNumber, user);
        return ResponseEntity.ok(ApiResponse.success(null));
    }
}
