package com.example.shop.modules.staff.controller;

import com.example.shop.common.exception.BusinessException;
import com.example.shop.common.response.ApiResponse;
import com.example.shop.modules.staff.dto.AssignShipperRequest;
import com.example.shop.modules.staff.dto.ShipperDto;
import com.example.shop.modules.staff.dto.ShipperLocationDto;
import com.example.shop.modules.staff.service.ShipperService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/staff")
@RequiredArgsConstructor
public class StaffShipperController {

    private final ShipperService shipperService;

    /**
     * GET /api/v1/staff/shippers
     * List all active shippers with their current active order count.
     */
    @GetMapping("/shippers")
    @PreAuthorize("hasAnyRole('ADMIN', 'STAFF', 'EMPLOYEE')")
    public ResponseEntity<List<ShipperDto>> listShippers() {
        return ResponseEntity.ok(shipperService.listShippers());
    }

    /**
     * POST /api/v1/staff/orders/{id}/assign-shipper
     * Assign or reassign a shipper to an order.
     */
    @PostMapping("/orders/{id}/assign-shipper")
    @PreAuthorize("hasAnyRole('ADMIN', 'STAFF', 'EMPLOYEE')")
    public ResponseEntity<ApiResponse<String>> assignShipper(
            @PathVariable Long id,
            @RequestBody @Valid AssignShipperRequest request,
            Authentication authentication
    ) {
        UUID shipperUserId;
        try {
            shipperUserId = UUID.fromString(request.getShipperUserId().trim());
        } catch (IllegalArgumentException ex) {
            throw new BusinessException("Invalid shipperUserId UUID", HttpStatus.BAD_REQUEST);
        }

        shipperService.assignShipper(id, shipperUserId, request.getExpectedDeliveryAt(), authentication.getName());
        return ResponseEntity.ok(ApiResponse.success("Shipper assigned successfully"));
    }

    /**
     * GET /api/v1/staff/shippers/{shipperUserId}/location
     * Fetch the current (latest) GPS location of a shipper.
     */
    @GetMapping("/shippers/{shipperUserId}/location")
    @PreAuthorize("hasAnyRole('ADMIN', 'STAFF', 'EMPLOYEE')")
    public ResponseEntity<ShipperLocationDto> getShipperLocation(
            @PathVariable String shipperUserId
    ) {
        UUID uuid;
        try {
            uuid = UUID.fromString(shipperUserId.trim());
        } catch (IllegalArgumentException ex) {
            throw new BusinessException("Invalid shipperUserId UUID", HttpStatus.BAD_REQUEST);
        }

        return shipperService.getShipperCurrentLocation(uuid)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }
}
