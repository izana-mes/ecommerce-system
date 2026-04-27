package com.example.shop.modules.coupon.controller;

import com.example.shop.common.response.ApiResponse;
import com.example.shop.modules.coupon.entity.Coupon;
import com.example.shop.modules.coupon.entity.CouponAssignment;
import com.example.shop.modules.coupon.service.CouponService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/v1/admin/coupons")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
public class AdminCouponController {

    private final CouponService couponService;

    @GetMapping
    public ResponseEntity<ApiResponse<Map<String, Object>>> listCoupons(
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "15") int size,
            @RequestParam(required = false) String q) {
        int pageIndex = Math.max(0, page - 1);
        int pageSize = Math.min(100, size);
        Page<Coupon> result = couponService.listCoupons(pageIndex, pageSize, q);
        Map<String, Object> body = Map.of(
                "content", result.getContent(),
                "totalElements", result.getTotalElements(),
                "totalPages", result.getTotalPages(),
                "number", result.getNumber(),
                "size", result.getSize()
        );
        return ResponseEntity.ok(ApiResponse.success(body));
    }

    @PostMapping
    public ResponseEntity<ApiResponse<String>> createCoupon(@RequestBody Map<String, Object> body) {
        couponService.createCoupon(body);
        return ResponseEntity.status(201).body(ApiResponse.success("Coupon created successfully"));
    }

    @PatchMapping
    public ResponseEntity<ApiResponse<String>> updateCoupon(@RequestBody Map<String, Object> body) {
        Object idObj = body.get("id");
        if (idObj == null) return ResponseEntity.badRequest().body(ApiResponse.error("Invalid id"));
        Long id;
        try { id = Long.parseLong(idObj.toString()); } catch (Exception e) { return ResponseEntity.badRequest().body(ApiResponse.error("Invalid id")); }
        couponService.updateCoupon(id, body);
        return ResponseEntity.ok(ApiResponse.success("Coupon updated successfully"));
    }

    @PostMapping("/{couponId}/issue")
    public ResponseEntity<ApiResponse<String>> issueCoupon(
            @PathVariable Long couponId,
            @RequestBody Map<String, Object> body,
            @AuthenticationPrincipal UserDetails principal) {
        String userId = getString(body, "user_id");
        String userEmail = getString(body, "user_email");
        String notificationTitle = getString(body, "notification_title");
        String notificationMessage = getString(body, "notification_message");
        String issuedByEmail = principal != null ? principal.getUsername() : getString(body, "issued_by_email");
        if (userId.isEmpty() || userEmail.isEmpty()) {
            return ResponseEntity.badRequest().body(ApiResponse.error("user_id and user_email are required"));
        }
        couponService.issueCoupon(couponId, userId, userEmail, notificationTitle, notificationMessage, issuedByEmail);
        return ResponseEntity.ok(ApiResponse.success("Coupon issued successfully"));
    }

    private String getString(Map<String, Object> map, String key) {
        Object val = map.get(key);
        return val != null ? val.toString().trim() : "";
    }
}
