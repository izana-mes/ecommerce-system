package com.example.shop.modules.admin.controller;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.util.StringUtils;
import org.springframework.web.bind.annotation.*;

import java.util.*;

@RestController
@RequestMapping("/api/v1/admin")
@RequiredArgsConstructor
@Slf4j
public class AdminOrderController {

    private final JdbcTemplate jdbcTemplate;

    private static final Set<String> ALLOWED_ORDER_STATUSES = Set.of(
            "pending", "processing", "paid", "shipped", "completed", "cancelled"
    );

    private static final Set<String> ALLOWED_PAYMENT_STATUSES = Set.of(
            "pending", "authorized", "paid", "failed", "refunded"
    );

    /**
     * PATCH /api/v1/admin/orders/{id}
     * Updates the order_status and/or payment_status of a given order.
     * At least one of orderStatus or paymentStatus must be provided.
     */
    @PatchMapping("/orders/{id}")
    @PreAuthorize("hasRole('ADMIN') or hasRole('SHIPPER')")
    public ResponseEntity<Map<String, Object>> updateOrderStatus(
            @PathVariable("id") long orderId,
            @RequestBody Map<String, String> body
    ) {
        String newOrderStatus = body.getOrDefault("orderStatus", "").trim().toLowerCase();
        String newPaymentStatus = body.getOrDefault("paymentStatus", "").trim().toLowerCase();

        if (!StringUtils.hasText(newOrderStatus) && !StringUtils.hasText(newPaymentStatus)) {
            return ResponseEntity.badRequest()
                    .body(Map.of("error", "At least one of orderStatus or paymentStatus must be provided"));
        }

        if (StringUtils.hasText(newOrderStatus) && !ALLOWED_ORDER_STATUSES.contains(newOrderStatus)) {
            return ResponseEntity.badRequest()
                    .body(Map.of("error", "Invalid orderStatus: " + newOrderStatus));
        }

        if (StringUtils.hasText(newPaymentStatus) && !ALLOWED_PAYMENT_STATUSES.contains(newPaymentStatus)) {
            return ResponseEntity.badRequest()
                    .body(Map.of("error", "Invalid paymentStatus: " + newPaymentStatus));
        }

        // Check shipper permissions
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        boolean isShipper = auth.getAuthorities().stream().anyMatch(a -> "ROLE_SHIPPER".equals(a.getAuthority()));
        if (isShipper) {
            if (StringUtils.hasText(newOrderStatus) && !"shipped".equals(newOrderStatus)) {
                return ResponseEntity.status(403)
                        .body(Map.of("error", "Shipper can only set order status to 'shipped'"));
            }
            if (StringUtils.hasText(newPaymentStatus)) {
                return ResponseEntity.status(403)
                        .body(Map.of("error", "Shipper cannot update payment status"));
            }
        }

        List<String> setClauses = new ArrayList<>();
        List<Object> params = new ArrayList<>();

        if (StringUtils.hasText(newOrderStatus)) {
            setClauses.add("order_status = ?");
            params.add(newOrderStatus);
        }
        if (StringUtils.hasText(newPaymentStatus)) {
            setClauses.add("payment_status = ?");
            params.add(newPaymentStatus);
        }
        setClauses.add("updated_at = CURRENT_TIMESTAMP");
        params.add(orderId);

        String sql = "UPDATE orders SET " + String.join(", ", setClauses) + " WHERE id = ?";

        try {
            int updated = jdbcTemplate.update(sql, params.toArray());
            if (updated == 0) {
                return ResponseEntity.status(404)
                        .body(Map.of("error", "Order not found: " + orderId));
            }
            Map<String, Object> response = new LinkedHashMap<>();
            response.put("message", "Order updated successfully");
            response.put("orderId", orderId);
            if (StringUtils.hasText(newOrderStatus)) response.put("orderStatus", newOrderStatus);
            if (StringUtils.hasText(newPaymentStatus)) response.put("paymentStatus", newPaymentStatus);
            return ResponseEntity.ok(response);
        } catch (Exception ex) {
            log.error("Failed to update order {}: {}", orderId, ex.getMessage());
            return ResponseEntity.internalServerError()
                    .body(Map.of("error", "Failed to update order: " + ex.getMessage()));
        }
    }
}
