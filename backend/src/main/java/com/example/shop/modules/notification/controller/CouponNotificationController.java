package com.example.shop.modules.notification.controller;

import com.example.shop.common.response.ApiResponse;
import com.example.shop.modules.notification.dto.CouponIssuedEmailRequest;
import com.example.shop.modules.notification.service.CouponNotificationService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/internal/notifications")
@RequiredArgsConstructor
@Slf4j
public class CouponNotificationController {

    private final CouponNotificationService couponNotificationService;

    @Value("${application.internal.notify-token:}")
    private String internalNotifyToken;

    @PostMapping("/coupon-issued")
    public ResponseEntity<ApiResponse<Void>> sendCouponIssuedNotification(
            @RequestHeader(value = "X-Internal-Token", required = false) String token,
            @RequestBody CouponIssuedEmailRequest request
    ) {
        String configuredToken = internalNotifyToken == null ? "" : internalNotifyToken.trim();
        String receivedToken = token == null ? "" : token.trim();

        if (!configuredToken.isEmpty() && !configuredToken.equals(receivedToken)) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(ApiResponse.error("Unauthorized"));
        }

        try {
            couponNotificationService.sendCouponIssuedEmail(request);
            return ResponseEntity.ok(ApiResponse.success(null, "Coupon email sent"));
        } catch (Exception ex) {
            Throwable root = ex;
            while (root.getCause() != null) {
                root = root.getCause();
            }
            String rootMessage = root.getMessage() == null ? "Failed to send email" : root.getMessage();
            String rootType = root.getClass().getSimpleName();
            String message = rootType + ": " + rootMessage;
            log.error("Failed to send coupon email to {} ({})", request.getTo(), message, ex);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(ApiResponse.error(message));
        }
    }
}
