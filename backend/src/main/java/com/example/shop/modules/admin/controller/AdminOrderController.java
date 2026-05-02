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

    private static boolean isTerminalOrderStatus(String value) {
        return Set.of("shipped", "completed", "cancelled").contains(value);
    }

    private static String limit(String value, int maxLen) {
        if (!StringUtils.hasText(value)) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.length() > maxLen ? trimmed.substring(0, maxLen) : trimmed;
    }

    /**
     * PATCH /api/v1/admin/orders/{id}
     * Updates the order_status and/or payment_status of a given order.
     * Admins may also PATCH only {@code carrier} / {@code trackingNumber} without changing statuses.
     * Shippers may only advance prepaid (payment {@code paid}) orders or Cash on Delivery orders awaiting collection
     * to {@code shipped}, optionally setting carrier / tracking fields.
     */
    @PatchMapping("/orders/{id}")
    @PreAuthorize("hasAnyRole('ADMIN', 'EMPLOYEE', 'SHIPPER')")
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
        boolean isEmployee = auth != null
                && auth.isAuthenticated()
                && auth.getAuthorities() != null
                && auth.getAuthorities().stream().anyMatch(a -> "ROLE_EMPLOYEE".equals(a.getAuthority()));

        String newOrderStatus = str(body.get("orderStatus")).toLowerCase(Locale.ROOT);
        String newPaymentStatus = str(body.get("paymentStatus")).toLowerCase();
        boolean hasCarrierKey = body.containsKey("carrier");
        boolean hasTrackingKey = body.containsKey("trackingNumber");
        String normalizedCarrier = hasCarrierKey ? limit(fulfillmentValue(body.get("carrier")), 80) : null;
        String normalizedTracking = hasTrackingKey ? limit(fulfillmentValue(body.get("trackingNumber")), 120) : null;

        if (!StringUtils.hasText(newOrderStatus) && !StringUtils.hasText(newPaymentStatus)) {
            boolean fulfillmentOnlyAllowed = (isAdmin || isEmployee) && !isShipper && (hasCarrierKey || hasTrackingKey);
            if (!fulfillmentOnlyAllowed) {
                return ResponseEntity.badRequest()
                        .body(Map.of("error",
                                "At least one of orderStatus or paymentStatus must be provided, "
                                        + "or admins/employees may patch carrier/trackingNumber alone"));
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

        List<Map<String, Object>> snapshot = jdbcTemplate.queryForList(
                "SELECT order_status, payment_status, payment_method, shipping_carrier, shipping_tracking_public FROM orders WHERE id = ?",
                orderId
        );
        if (snapshot.isEmpty()) {
            return ResponseEntity.status(404).body(Map.of("error", "Order not found: " + orderId));
        }
        String curOrderStatus = Objects.toString(snapshot.get(0).get("order_status"), "").trim().toLowerCase(Locale.ROOT);
        String curPaymentStatus = Objects.toString(snapshot.get(0).get("payment_status"), "").trim().toLowerCase(Locale.ROOT);
        String curPaymentMethod = Objects.toString(snapshot.get(0).get("payment_method"), "");
        String curCarrier = limit(Objects.toString(snapshot.get(0).get("shipping_carrier"), ""), 80);
        String curTracking = limit(Objects.toString(snapshot.get(0).get("shipping_tracking_public"), ""), 120);

        if ("shipped".equals(newOrderStatus) && isTerminalOrderStatus(curOrderStatus)) {
            return ResponseEntity.status(409)
                    .body(Map.of("error", "Order can no longer be marked as shipped"));
        }

        if (StringUtils.hasText(normalizedTracking) && !StringUtils.hasText(normalizedCarrier) && !StringUtils.hasText(curCarrier)) {
            return ResponseEntity.badRequest()
                    .body(Map.of("error", "Carrier is required when trackingNumber is provided"));
        }

        if ("shipped".equals(newOrderStatus)) {
            boolean hasAnyShipmentDetail = StringUtils.hasText(normalizedCarrier)
                    || StringUtils.hasText(normalizedTracking)
                    || StringUtils.hasText(curCarrier)
                    || StringUtils.hasText(curTracking);
            if (!hasAnyShipmentDetail) {
                return ResponseEntity.badRequest()
                        .body(Map.of("error", "Set carrier and/or trackingNumber before marking shipped"));
            }
        }

        if (isShipper || isEmployee) {
            if (!StringUtils.hasText(newOrderStatus) && !StringUtils.hasText(newPaymentStatus)
                    && (hasCarrierKey || hasTrackingKey)) {
                return ResponseEntity.status(403)
                        .body(Map.of("error", "Shipper/employee must set orderStatus to shipped when updating shipment details"));
            }
            if (StringUtils.hasText(newOrderStatus) && !"shipped".equals(newOrderStatus)) {
                return ResponseEntity.status(403)
                        .body(Map.of("error", "Shipper/employee can only set order status to 'shipped'"));
            }
            if (StringUtils.hasText(newPaymentStatus)) {
                return ResponseEntity.status(403)
                        .body(Map.of("error", "Shipper/employee cannot update payment status"));
            }
            if (!shipperMayMarkShipped(curOrderStatus, curPaymentStatus, curPaymentMethod)) {
                return ResponseEntity.status(403)
                        .body(Map.of(
                                "error",
                                "Shipper/employee may only ship prepaid (paid payment) orders, or Cash on Delivery orders awaiting pickup/collection"));
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
            params.add(normalizedCarrier);
        }
        if (hasTrackingKey) {
            setClauses.add("shipping_tracking_public = ?");
            params.add(normalizedTracking);
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
                response.put("carrier", normalizedCarrier);
            }
            if (hasTrackingKey) {
                response.put("trackingNumber", normalizedTracking);
            }
            response.put("previousOrderStatus", curOrderStatus);
            return ResponseEntity.ok(response);
        } catch (Exception ex) {
            log.error("Failed to update order {}: {}", orderId, ex.getMessage());
            return ResponseEntity.internalServerError()
                    .body(Map.of("error", "Failed to update order: " + ex.getMessage()));
        }
    }

    /** Prepaid lanes or COD awaiting collection (checkout stores method as \"Cash on delivery\"). */
    private static boolean shipperMayMarkShipped(String curOrderStatus, String curPaymentStatus, String paymentMethod) {
        boolean paidLane = "paid".equals(curPaymentStatus) && Set.of("paid", "processing").contains(curOrderStatus);
        boolean codLane = isCashOnDelivery(paymentMethod)
                && Set.of("pending", "authorized").contains(curPaymentStatus)
                && Set.of("pending", "processing").contains(curOrderStatus);
        return paidLane || codLane;
    }

    private static boolean isCashOnDelivery(String raw) {
        if (!StringUtils.hasText(raw)) {
            return false;
        }
        String pm = raw.trim().toLowerCase(Locale.ROOT);
        return "cod".equals(pm)
                || pm.contains("cash on delivery")
                || (pm.contains("cash") && pm.contains("deliver"));
    }
}
