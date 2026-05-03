package com.example.shop.modules.shipper.controller;

import com.example.shop.common.response.ApiResponse;
import com.example.shop.modules.shipper.dto.ShipperDtos;
import com.example.shop.modules.shipper.service.ShipperRealtimeService;
import com.example.shop.modules.user.entity.User;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/shipper")
@RequiredArgsConstructor
public class ShipperFeatureController {

    private final ShipperRealtimeService shipperRealtimeService;

    @PostMapping("/location")
    @PreAuthorize("hasRole('SHIPPER')")
    public ResponseEntity<ApiResponse<ShipperDtos.LocationPayload>> updateLocation(
            @AuthenticationPrincipal User user,
            @RequestBody ShipperDtos.LocationUpdateRequest request
    ) {
        return ResponseEntity.ok(ApiResponse.success(shipperRealtimeService.updateLocation(user, request, "REST")));
    }

    @GetMapping("/shippers/{shipperUserId}/location/latest")
    @PreAuthorize("hasAnyRole('ADMIN', 'EMPLOYEE', 'SHIPPER')")
    public ResponseEntity<ApiResponse<ShipperDtos.LocationPayload>> getLatestLocation(@PathVariable UUID shipperUserId) {
        return ResponseEntity.ok(ApiResponse.success(shipperRealtimeService.getLatestLocation(shipperUserId)));
    }

    @GetMapping("/orders/{orderId}/tracking")
    @PreAuthorize("hasAnyRole('ADMIN', 'EMPLOYEE', 'SHIPPER', 'USER')")
    public ResponseEntity<ApiResponse<ShipperDtos.OrderTrackingResponse>> getOrderTracking(@PathVariable long orderId) {
        return ResponseEntity.ok(ApiResponse.success(shipperRealtimeService.getOrderTracking(orderId)));
    }

    @PostMapping("/orders/{orderId}/status")
    @PreAuthorize("hasRole('SHIPPER')")
    public ResponseEntity<ApiResponse<Void>> updateOrderStatus(
            @AuthenticationPrincipal User user,
            @PathVariable long orderId,
            @RequestBody ShipperDtos.StatusUpdateRequest request
    ) {
        shipperRealtimeService.updateOrderStatus(user, orderId, request);
        return ResponseEntity.ok(ApiResponse.success(null));
    }

    @GetMapping("/shippers/{shipperUserId}/performance")
    @PreAuthorize("hasAnyRole('ADMIN', 'EMPLOYEE', 'SHIPPER')")
    public ResponseEntity<ApiResponse<ShipperDtos.PerformanceResponse>> getPerformance(
            @PathVariable UUID shipperUserId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime to
    ) {
        return ResponseEntity.ok(ApiResponse.success(shipperRealtimeService.getPerformance(shipperUserId, from, to)));
    }

    @PostMapping("/orders/{orderId}/issues")
    @PreAuthorize("hasRole('SHIPPER')")
    public ResponseEntity<ApiResponse<ShipperDtos.IssueResponse>> createIssue(
            @AuthenticationPrincipal User user,
            @PathVariable long orderId,
            @RequestBody ShipperDtos.IssueCreateRequest request
    ) {
        return ResponseEntity.ok(ApiResponse.success(shipperRealtimeService.createIssue(user, orderId, request)));
    }

    @GetMapping("/orders/{orderId}/issues")
    @PreAuthorize("hasAnyRole('ADMIN', 'EMPLOYEE', 'SHIPPER')")
    public ResponseEntity<ApiResponse<List<ShipperDtos.IssueResponse>>> getOrderIssues(@PathVariable long orderId) {
        return ResponseEntity.ok(ApiResponse.success(shipperRealtimeService.getOrderIssues(orderId)));
    }

    @PostMapping("/orders/{orderId}/help-request")
    @PreAuthorize("hasRole('SHIPPER')")
    public ResponseEntity<ApiResponse<ShipperDtos.HelpRequestResponse>> createHelpRequest(
            @AuthenticationPrincipal User user,
            @PathVariable long orderId,
            @RequestBody ShipperDtos.HelpRequestCreateRequest request
    ) {
        return ResponseEntity.ok(ApiResponse.success(shipperRealtimeService.createHelpRequest(user, orderId, request)));
    }
}
