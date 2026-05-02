package com.example.shop.modules.operations.controller;

import com.example.shop.common.response.ApiResponse;
import com.example.shop.modules.order.service.OrderService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/api/v1/staff")
@RequiredArgsConstructor
public class StaffFulfillmentInsightsController {

    private final OrderService orderService;

    /**
     * Light-weight dashboard metrics for admin / CS employees (supplier and shipper roles excluded).
     */
    @GetMapping("/order-insights")
    @PreAuthorize("hasAnyRole('ADMIN', 'EMPLOYEE')")
    public ResponseEntity<ApiResponse<Map<String, Long>>> orderInsights() {
        return ResponseEntity.ok(ApiResponse.success(orderService.fulfillmentInsightsForStaff()));
    }
}
