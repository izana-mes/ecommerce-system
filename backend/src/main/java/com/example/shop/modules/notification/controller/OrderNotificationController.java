package com.example.shop.modules.notification.controller;

import com.example.shop.common.response.ApiResponse;
import com.example.shop.modules.notification.dto.OrderPaidEmailRequest;
import com.example.shop.modules.notification.service.OrderNotificationService;
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
public class OrderNotificationController {

    private final OrderNotificationService orderNotificationService;

    @Value("${application.internal.notify-token:}")
    private String internalNotifyToken;

    @PostMapping("/order-paid")
    public ResponseEntity<ApiResponse<Void>> sendOrderPaidNotification(
            @RequestHeader(value = "X-Internal-Token", required = false) String token,
            @RequestBody OrderPaidEmailRequest request
    ) {
        String configuredToken = internalNotifyToken == null ? "" : internalNotifyToken.trim();
        String receivedToken = token == null ? "" : token.trim();

        if (!configuredToken.isEmpty() && !configuredToken.equals(receivedToken)) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(ApiResponse.error("Unauthorized"));
        }

        try {
            orderNotificationService.sendOrderPaidEmail(request);
            return ResponseEntity.ok(ApiResponse.success(null, "Order confirmation email queued"));
        } catch (Exception ex) {
            Throwable root = ex;
            while (root.getCause() != null) {
                root = root.getCause();
            }
            String message = root.getMessage() == null ? "Failed to send email" : root.getMessage();
            log.error("Failed to send order confirmation email to {}", request.getTo(), ex);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(ApiResponse.error(message));
        }
    }
}
