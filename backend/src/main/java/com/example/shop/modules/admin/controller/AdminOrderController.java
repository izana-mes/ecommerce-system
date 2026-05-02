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

    private static String str(Object raw) {
        if (raw == null) {
            return "";
        }
        return Objects.toString(raw, "").trim();
    }

    private static String fulfillmentValue(Object raw) {
        String s = str(raw);
        return s.isEmpty() ? null : s;
    }

    /**
     * PATCH /api/v1/admin/orders/{id}
     * Updates the order_status and/or payment_status of a given order.
     * Admins may also PATCH only {@code carrier} / {@code trackingNumber} without changing statuses.
     * Shippers may only advance eligible paid orders to {@code shipped} and may optionally set carrier / tracking fields.
     */
    @PatchMapping("/orders/{id}")
    @PreAuthorize("hasRole('ADMIN') or hasRole('SHIPPER')")
    public ResponseEntity<Map<String, Object>> updateOrderStatus(
            @PathVariable("id") long orderId,
            @RequestBody Map<String, Object> body
    ) {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        boolean isShipper = auth != null
                && auth.isAuthenticated()
                && auth.getAuthorities() != null
                && auth.getAuthorities().stream().anyMatch(a -> "ROLE_SHIPPER".equals(a.getAuthority()));
        boolean isAdmin = auth != null
                && auth.isAuthenticated()
                && auth.getAuthorities() != null
                && auth.getAuthorities().stream().anyMatch(a -> "ROLE_ADMIN".equals(a.getAuthority()));

        String newOrderStatus = str(body.get("orderStatus")).toLowerCase();
        String newPaymentStatus = str(body.get("paymentStatus")).toLowerCase();
        boolean hasCarrierKey = body.containsKey("carrier");
        boolean hasTrackingKey = body.containsKey("trackingNumber");

        if (!StringUtils.hasText(newOrderStatus) && !StringUtils.hasText(newPaymentStatus)) {
            boolean fulfillmentOnlyAllowed = isAdmin && !isShipper && (hasCarrierKey || hasTrackingKey);
            if (!fulfillmentOnlyAllowed) {
                return ResponseEntity.badRequest()
                        .body(Map.of("error",
                                "At least one of orderStatus or paymentStatus must be provided, "
                                        + "or admins may patch carrier/trackingNumber alone"));
            }
        }

        if (StringUtils.hasText(newOrderStatus) && !ALLOWED_ORDER_STATUSES.contains(newOrderStatus)) {
            return ResponseEntity.badRequest()
                    .body(Map.of("error", "Invalid orderStatus: " + newOrderStatus));
        }

        if (StringUtils.hasText(newPaymentStatus) && !ALLOWED_PAYMENT_STATUSES.contains(newPaymentStatus)) {
            return ResponseEntity.badRequest()
                    .body(Map.of("error", "Invalid paymentStatus: " + newPaymentStatus));
        }

        if (isShipper) {
            if (!StringUtils.hasText(newOrderStatus) && !StringUtils.hasText(newPaymentStatus)
                    && (hasCarrierKey || hasTrackingKey)) {
                return ResponseEntity.status(403)
                        .body(Map.of("error", "Shipper must set orderStatus to shipped when updating shipment details"));
            }
            if (StringUtils.hasText(newOrderStatus) && !"shipped".equals(newOrderStatus)) {
                return ResponseEntity.status(403)
                        .body(Map.of("error", "Shipper can only set order status to 'shipped'"));
            }
            if (StringUtils.hasText(newPaymentStatus)) {
                return ResponseEntity.status(403)
                        .body(Map.of("error", "Shipper cannot update payment status"));
            }
            List<Map<String, Object>> snapshot = jdbcTemplate.queryForList(
                    "SELECT order_status, payment_status FROM orders WHERE id = ?", orderId);
            if (snapshot.isEmpty()) {
                return ResponseEntity.status(404)
                        .body(Map.of("error", "Order not found: " + orderId));
            }
            String curOrderStatus = Objects.toString(snapshot.get(0).get("order_status"), "").trim().toLowerCase();
            String curPaymentStatus = Objects.toString(snapshot.get(0).get("payment_status"), "").trim().toLowerCase();
            if ("shipped".equals(curOrderStatus) || "completed".equals(curOrderStatus) || "cancelled".equals(curOrderStatus)) {
                return ResponseEntity.status(409)
                        .body(Map.of("error", "Order can no longer be marked as shipped"));
            }
            if (!"paid".equals(curPaymentStatus)) {
                return ResponseEntity.status(403)
                        .body(Map.of("error", "Shipper may only ship orders that are fully paid"));
            }
            if (!Set.of("paid", "processing").contains(curOrderStatus)) {
                return ResponseEntity.status(403)
                        .body(Map.of("error", "Shipper may only ship orders in 'paid' or 'processing' status"));
            }
        }

        List<String> setClauses = new ArrayList<>();
        List<Object> params = new ArrayList<>();

        if (StringUtils.hasText(newOrderStatus)) {
            setClauses.add("order_status = ?");
            params.add(newOrderStatus);
            if ("shipped".equals(newOrderStatus)) {
                setClauses.add("shipped_at = CURRENT_TIMESTAMP");
            }
        }
        if (StringUtils.hasText(newPaymentStatus)) {
            setClauses.add("payment_status = ?");
            params.add(newPaymentStatus);
        }
        if (hasCarrierKey) {
            setClauses.add("shipping_carrier = ?");
            params.add(fulfillmentValue(body.get("carrier")));
        }
        if (hasTrackingKey) {
            setClauses.add("shipping_tracking_public = ?");
            params.add(fulfillmentValue(body.get("trackingNumber")));
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
            if (StringUtils.hasText(newOrderStatus)) {
                response.put("orderStatus", newOrderStatus);
            }
            if (StringUtils.hasText(newPaymentStatus)) {
                response.put("paymentStatus", newPaymentStatus);
            }
            if (hasCarrierKey) {
                response.put("carrier", fulfillmentValue(body.get("carrier")));
            }
            if (hasTrackingKey) {
                response.put("trackingNumber", fulfillmentValue(body.get("trackingNumber")));
            }
            return ResponseEntity.ok(response);
        } catch (Exception ex) {
            log.error("Failed to update order {}: {}", orderId, ex.getMessage());
            return ResponseEntity.internalServerError()
                    .body(Map.of("error", "Failed to update order: " + ex.getMessage()));
        }
    }
}
