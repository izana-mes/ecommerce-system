package com.example.shop.modules.order.controller;

import com.example.shop.common.response.ApiResponse;
import com.example.shop.modules.messaging.order.OrderStatusChangedEvent;
import com.example.shop.modules.messaging.order.OrderStatusChangedPublisher;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/orders")
@RequiredArgsConstructor
@Slf4j
public class OrderStatusController {

    private final OrderStatusChangedPublisher orderStatusChangedPublisher;

    @PostMapping("/status-changed")
    public ResponseEntity<ApiResponse<Void>> publishStatusChanged(@RequestBody Map<String, String> body) {
        try {
            OrderStatusChangedEvent event = OrderStatusChangedEvent.builder()
                    .orderId(parseLong(body.get("orderId")))
                    .orderNumber(body.getOrDefault("orderNumber", ""))
                    .customerEmail(body.getOrDefault("customerEmail", ""))
                    .customerName(body.getOrDefault("customerName", ""))
                    .oldStatus(body.getOrDefault("oldStatus", ""))
                    .newStatus(body.getOrDefault("newStatus", ""))
                    .oldPaymentStatus(body.getOrDefault("oldPaymentStatus", ""))
                    .newPaymentStatus(body.getOrDefault("newPaymentStatus", ""))
                    .build();

            orderStatusChangedPublisher.publish(event);
            return ResponseEntity.ok(ApiResponse.success(null, "Status change event published"));
        } catch (Exception e) {
            log.error("Failed to publish status change event", e);
            return ResponseEntity.internalServerError()
                    .body(ApiResponse.error("Failed to publish event: " + e.getMessage()));
        }
    }

    private Long parseLong(String value) {
        try {
            return Long.parseLong(value);
        } catch (Exception e) {
            return 0L;
        }
    }
}
