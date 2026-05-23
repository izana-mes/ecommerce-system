package com.example.shop.modules.inventory.controller;

import com.example.shop.modules.inventory.dto.InventoryReservationDtos;
import com.example.shop.modules.inventory.service.InventoryReservationService;
import com.example.shop.modules.user.entity.User;
import jakarta.validation.Valid;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/inventory/reservations")
@RequiredArgsConstructor
public class InventoryReservationController {

    private final InventoryReservationService inventoryReservationService;

    @PostMapping
    public ResponseEntity<InventoryReservationDtos.ReservationResponse> reserve(
            @Valid @RequestBody InventoryReservationDtos.ReserveRequest request,
            @AuthenticationPrincipal User user
    ) {
        return ResponseEntity.ok(inventoryReservationService.reserve(request, user));
    }

    @PostMapping("/{reservationCode}/confirm")
    public ResponseEntity<InventoryReservationDtos.ReservationResponse> confirm(
            @PathVariable String reservationCode
    ) {
        return ResponseEntity.ok(inventoryReservationService.confirm(reservationCode));
    }

    @PostMapping("/{reservationCode}/release")
    public ResponseEntity<InventoryReservationDtos.ReservationResponse> release(
            @PathVariable String reservationCode,
            @RequestBody(required = false) ReleaseRequest request
    ) {
        String reason = request == null ? null : request.getReason();
        return ResponseEntity.ok(inventoryReservationService.release(reservationCode, reason));
    }

    @Data
    private static class ReleaseRequest {
        private String reason;
    }
}
