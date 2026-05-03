package com.example.shop.modules.staff.controller;

import com.example.shop.common.response.ApiResponse;
import com.example.shop.modules.staff.dto.AdminOrderStatusRequest;
import com.example.shop.modules.staff.dto.StaffOrderFilterRequest;
import com.example.shop.modules.staff.dto.StaffOrderPageDto;
import com.example.shop.modules.staff.service.StaffOrderService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;

@RestController
@RequestMapping("/api/v1/staff/orders")
@RequiredArgsConstructor
public class StaffOrderController {

    private final StaffOrderService staffOrderService;

    /**
     * GET /api/v1/staff/orders
     * View all orders with filtering by status, paymentStatus, dateFrom, dateTo, shipperUserId, supplierProductId.
     */
    @GetMapping
    @PreAuthorize("hasAnyRole('ADMIN', 'STAFF', 'EMPLOYEE')")
    public ResponseEntity<StaffOrderPageDto> listOrders(
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String paymentStatus,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate dateFrom,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate dateTo,
            @RequestParam(required = false) String shipperUserId,
            @RequestParam(required = false) String supplierProductId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size
    ) {
        StaffOrderFilterRequest filter = new StaffOrderFilterRequest();
        filter.setStatus(status);
        filter.setPaymentStatus(paymentStatus);
        filter.setDateFrom(dateFrom);
        filter.setDateTo(dateTo);
        filter.setShipperUserId(shipperUserId);
        filter.setSupplierProductId(supplierProductId);
        filter.setPage(page);
        filter.setSize(size);

        return ResponseEntity.ok(staffOrderService.listOrders(filter));
    }

    /**
     * PATCH /api/v1/staff/orders/{id}/status
     * Admin override: update order_status and/or payment_status with audit trail.
     */
    @PatchMapping("/{id}/status")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<String>> overrideStatus(
            @PathVariable Long id,
            @RequestBody @Valid AdminOrderStatusRequest request,
            Authentication authentication
    ) {
        String changedBy = authentication.getName();
        staffOrderService.overrideOrderStatus(
                id,
                request.getOrderStatus(),
                request.getPaymentStatus(),
                request.getReason(),
                changedBy
        );
        return ResponseEntity.ok(ApiResponse.success("Order status updated successfully"));
    }
}
