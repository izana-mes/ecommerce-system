package com.example.shop.modules.coupon.controller;

import com.example.shop.common.response.ApiResponse;
import com.example.shop.modules.coupon.entity.CouponAssignment;
import com.example.shop.modules.coupon.service.CouponService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/coupons")
@RequiredArgsConstructor
public class CouponController {

    private final CouponService couponService;

    /** Validate a coupon code (no redemption yet — just checks eligibility and computes discount). */
    @PostMapping("/validate")
    public ResponseEntity<ApiResponse<Map<String, Object>>> validateCoupon(
            @RequestBody Map<String, Object> body,
            @AuthenticationPrincipal UserDetails principal) {
        String code = getString(body, "code");
        BigDecimal subtotal = toBigDecimal(body.get("subtotal"));
        String userId = principal != null ? principal.getUsername() : null;
        if (code.isEmpty()) return ResponseEntity.badRequest().body(ApiResponse.error("code is required"));
        if (subtotal == null) return ResponseEntity.badRequest().body(ApiResponse.error("subtotal is required"));
        CouponService.ValidatedCoupon result = couponService.validateCoupon(code, userId, subtotal);
        Map<String, Object> data = Map.of(
                "couponId", result.couponId(),
                "assignmentId", result.assignmentId() != null ? result.assignmentId() : "",
                "code", result.code(),
                "title", result.title(),
                "discountType", result.discountType(),
                "discountValue", result.discountValue(),
                "discountAmount", result.discountAmount()
        );
        return ResponseEntity.ok(ApiResponse.success(data));
    }

    /** Redeem a coupon (called when an order is placed). */
    @PostMapping("/redeem")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<Map<String, Object>>> redeemCoupon(
            @RequestBody Map<String, Object> body,
            @AuthenticationPrincipal UserDetails principal) {
        String code = getString(body, "code");
        BigDecimal subtotal = toBigDecimal(body.get("subtotal"));
        Long orderId = toLong(body.get("orderId"));
        String userId = principal != null ? principal.getUsername() : null;
        if (code.isEmpty() || subtotal == null || orderId == null || userId == null) {
            return ResponseEntity.badRequest().body(ApiResponse.error("code, subtotal, orderId and authentication are required"));
        }
        CouponService.ValidatedCoupon result = couponService.redeemCoupon(orderId, code, userId, subtotal);
        Map<String, Object> data = Map.of(
                "couponId", result.couponId(),
                "assignmentId", result.assignmentId() != null ? result.assignmentId() : "",
                "code", result.code(),
                "discountAmount", result.discountAmount()
        );
        return ResponseEntity.ok(ApiResponse.success(data));
    }

    /** List coupon assignments (notifications) for the logged-in user. */
    @GetMapping("/notifications")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<List<CouponAssignment>>> getNotifications(
            @AuthenticationPrincipal UserDetails principal) {
        String userId = principal.getUsername();
        List<CouponAssignment> assignments = couponService.getUserNotifications(userId);
        return ResponseEntity.ok(ApiResponse.success(assignments));
    }

    /** Acknowledge a coupon assignment. */
    @PostMapping("/notifications/{id}/acknowledge")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<String>> acknowledge(
            @PathVariable Long id,
            @AuthenticationPrincipal UserDetails principal) {
        couponService.acknowledgeAssignment(id, principal.getUsername());
        return ResponseEntity.ok(ApiResponse.success("Acknowledged"));
    }

    private String getString(Map<String, Object> map, String key) {
        Object val = map.get(key);
        return val != null ? val.toString().trim() : "";
    }

    private BigDecimal toBigDecimal(Object o) {
        if (o == null) return null;
        try { return new BigDecimal(o.toString()); } catch (Exception e) { return null; }
    }

    private Long toLong(Object o) {
        if (o == null) return null;
        try { return Long.parseLong(o.toString()); } catch (Exception e) { return null; }
    }
}
