package com.example.shop.modules.payment.paypal.service;

import com.example.shop.common.observability.ObservabilityMetrics;
import com.example.shop.modules.coupon.service.CouponService;
import com.example.shop.modules.messaging.notification.OrderPaidEmailMessagePublisher;
import com.example.shop.modules.messaging.order.OrderStatusChangedEvent;
import com.example.shop.modules.messaging.order.OrderStatusChangedPublisher;
import com.example.shop.modules.notification.dto.OrderPaidEmailRequest;
import com.example.shop.modules.payment.paypal.config.PayPalProperties;
import com.example.shop.modules.payment.paypal.dto.PayPalCaptureRequest;
import com.example.shop.modules.payment.paypal.dto.PayPalCaptureResponse;
import com.example.shop.modules.payment.paypal.dto.PayPalCreateOrderResponse;
import com.example.shop.modules.payment.paypal.exception.PayPalApiException;
import com.example.shop.modules.user.entity.User;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.paypal.core.PayPalHttpClient;
import com.paypal.http.HttpResponse;
import com.paypal.orders.AmountBreakdown;
import com.paypal.orders.AmountWithBreakdown;
import com.paypal.orders.ApplicationContext;
import com.paypal.orders.Capture;
import com.paypal.orders.Money;
import com.paypal.orders.Order;
import com.paypal.orders.OrderRequest;
import com.paypal.orders.OrdersCaptureRequest;
import com.paypal.orders.OrdersCreateRequest;
import com.paypal.orders.PurchaseUnitRequest;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.io.IOException;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Production-grade PayPal payment service.
 *
 * <h2>Security Design</h2>
 * <ul>
 *   <li>Amount is always read from the DB — never trusted from the client.</li>
 *   <li>Capture is idempotent: duplicate events are rejected via {@code payment_webhook_events}.</li>
 *   <li>PayPal capture amount is re-validated against the DB total after capture.</li>
 *   <li>PayPal client secret never leaves the server.</li>
 * </ul>
 *
 * <h2>Flow</h2>
 * <pre>
 *   1. POST /api/payments/paypal/create-order   → createPayPalOrder()
 *   2. Frontend shows PayPal button → user approves on PayPal
 *   3. POST /api/payments/paypal/capture-order  → capturePayPalOrder()
 *   4. Backend calls PayPal capture API → verifies amount → updates DB → emits event
 * </pre>
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class PayPalPaymentServiceImpl implements PayPalPaymentService {

    private final PayPalHttpClient payPalHttpClient;
    private final PayPalProperties payPalProperties;
    private final JdbcTemplate jdbcTemplate;
    private final ObjectMapper objectMapper;
    private final OrderPaidEmailMessagePublisher orderPaidEmailMessagePublisher;
    private final OrderStatusChangedPublisher orderStatusChangedPublisher;
    private final CouponService couponService;
    private final ObservabilityMetrics observabilityMetrics;

    // ──────────────────────────────────────────────────────────────────────────
    //  Public API
    // ──────────────────────────────────────────────────────────────────────────

    @Override
    @Transactional
    public PayPalCreateOrderResponse createPayPalOrder(String orderNumber, User user) {
        assertConfigured();

        OrderSnapshot order = findOrderByOrderNumber(orderNumber);
        if (order == null) {
            throw new com.example.shop.common.exception.BusinessException(
                    "Order not found: " + orderNumber, HttpStatus.NOT_FOUND);
        }
        if (!"pending".equalsIgnoreCase(order.paymentStatus())) {
            throw new com.example.shop.common.exception.BusinessException(
                    "Order is not in pending payment state", HttpStatus.CONFLICT);
        }
        if (user != null && StringUtils.hasText(user.getEmail())
                && !user.getEmail().equalsIgnoreCase(order.customerEmail())) {
            throw new com.example.shop.common.exception.BusinessException(
                    "Order does not belong to this user", HttpStatus.FORBIDDEN);
        }

        String currency = StringUtils.hasText(order.currency()) ? order.currency().toUpperCase() : "USD";
        String amount = order.totalAmount().setScale(2, RoundingMode.HALF_UP).toPlainString();

        OrderRequest orderRequest = buildPayPalOrderRequest(amount, currency, order.orderNumber());

        OrdersCreateRequest createRequest = new OrdersCreateRequest();
        createRequest.prefer("return=representation");
        createRequest.requestBody(orderRequest);

        try {
            HttpResponse<Order> response = payPalHttpClient.execute(createRequest);
            Order paypalOrder = response.result();
            String paypalOrderId = paypalOrder.id();

            log.info("[PayPal] Created order id={} for orderNumber={} amount={} {}",
                    paypalOrderId, orderNumber, amount, currency);

            // Persist the PayPal order ID in the payments metadata immediately
            persistPayPalOrderId(order.id(), paypalOrderId, currency);

            return PayPalCreateOrderResponse.builder()
                    .paypalOrderId(paypalOrderId)
                    .orderNumber(order.orderNumber())
                    .build();

        } catch (IOException e) {
            log.error("[PayPal] Failed to create PayPal order for {}: {}", orderNumber, e.getMessage(), e);
            throw new PayPalApiException("PayPal order creation failed: " + e.getMessage(), e);
        }
    }

    @Override
    @Transactional
    public PayPalCaptureResponse capturePayPalOrder(PayPalCaptureRequest request, User user) {
        assertConfigured();
        long startedAt = System.currentTimeMillis();
        String metricStatus = "error";

        try {
            String paypalOrderId = request.getPaypalOrderId().trim();
            String orderNumber = request.getOrderNumber().trim();

            log.info("[PayPal] Capture attempt: paypalOrderId={} orderNumber={}", paypalOrderId, orderNumber);

            // 1. Load order from DB — source of truth
            OrderSnapshot order = findOrderByOrderNumber(orderNumber);
            if (order == null) {
                metricStatus = "order_not_found";
                return PayPalCaptureResponse.builder()
                        .success(false).message("Order not found").orderNumber(orderNumber).build();
            }

            // 2. Ownership check
            if (user != null && StringUtils.hasText(user.getEmail())
                    && !user.getEmail().equalsIgnoreCase(order.customerEmail())) {
                metricStatus = "ownership_denied";
                throw new com.example.shop.common.exception.BusinessException(
                        "Order does not belong to this user", HttpStatus.FORBIDDEN);
            }

            // 3. Idempotency — block duplicate capture of same PayPal order
            if ("paid".equalsIgnoreCase(order.paymentStatus())) {
                metricStatus = "already_paid";
                log.info("[PayPal] Order {} already paid — skipping capture", orderNumber);
                return PayPalCaptureResponse.builder()
                        .success(true).message("Order already paid").orderNumber(orderNumber)
                        .paymentStatus("paid").build();
            }

            if (!tryAcquireIdempotencyLock("paypal", paypalOrderId, orderNumber)) {
                metricStatus = "duplicate_event";
                log.warn("[PayPal] Duplicate capture attempt for paypalOrderId={}", paypalOrderId);
                return PayPalCaptureResponse.builder()
                        .success(false).message("Payment already processed").orderNumber(orderNumber).build();
            }

            // 4. Execute server-side capture via PayPal API
            OrdersCaptureRequest captureRequest = new OrdersCaptureRequest(paypalOrderId);
            captureRequest.prefer("return=representation");

            HttpResponse<Order> captureResponse;
            try {
                captureResponse = payPalHttpClient.execute(captureRequest);
            } catch (IOException e) {
                log.error("[PayPal] Capture API call failed for paypalOrderId={}: {}", paypalOrderId, e.getMessage(), e);
                // Release the idempotency lock since we never actually processed it
                releaseIdempotencyLock("paypal", paypalOrderId);
                throw new PayPalApiException("PayPal capture API call failed", e);
            }

            Order capturedOrder = captureResponse.result();
            String captureStatus = capturedOrder.status();
            log.info("[PayPal] Capture result: paypalOrderId={} status={}", paypalOrderId, captureStatus);

            // 5. Extract capture details from the PayPal response
            CaptureDetails details = extractCaptureDetails(capturedOrder);
            boolean paid = "COMPLETED".equalsIgnoreCase(captureStatus)
                    && "COMPLETED".equalsIgnoreCase(details.status());

            // 6. Validate captured amount against DB amount (tamper prevention)
            if (paid && details.amount() != null) {
                BigDecimal capturedAmount = new BigDecimal(details.amount()).setScale(2, RoundingMode.HALF_UP);
                BigDecimal expectedAmount = order.totalAmount().setScale(2, RoundingMode.HALF_UP);
                if (capturedAmount.compareTo(expectedAmount) != 0) {
                    log.error("[PayPal] AMOUNT MISMATCH for order={}: expected={} captured={}",
                            orderNumber, expectedAmount, capturedAmount);
                    // Mark as failed — refund should be triggered manually / via webhook
                    paid = false;
                    metricStatus = "amount_mismatch";
                }
            }

            String paymentStatus = paid ? "paid" : "failed";
            String orderStatus = paid ? "paid" : "cancelled";

            // 7. Persist results atomically
            updateOrderStatus(order.id(), orderStatus, paymentStatus);
            updatePaymentRecord(order.id(), paypalOrderId, details, paymentStatus, paid);

            if (paid) {
                metricStatus = "paid";
                log.info("[PayPal] Payment SUCCESSFUL for order={} captureId={}", orderNumber, details.captureId());
                triggerPostPaymentActions(order);
            } else {
                metricStatus = "failed";
                log.warn("[PayPal] Payment FAILED/INCOMPLETE for order={} captureStatus={}", orderNumber, captureStatus);
                publishStatusChangedEvent(order, orderStatus, paymentStatus);
            }

            return PayPalCaptureResponse.builder()
                    .success(paid)
                    .message(paid ? "Payment successful" : "Payment failed or incomplete")
                    .orderNumber(orderNumber)
                    .captureId(details.captureId())
                    .paymentStatus(paymentStatus)
                    .build();

        } finally {
            observabilityMetrics.recordPaymentIpn("paypal", metricStatus,
                    System.currentTimeMillis() - startedAt);
        }
    }

    // ──────────────────────────────────────────────────────────────────────────
    //  Private helpers
    // ──────────────────────────────────────────────────────────────────────────

    private void assertConfigured() {
        if (payPalProperties.getClientId().isBlank()
                || payPalProperties.getClientSecret().isBlank()) {
            throw new PayPalApiException("PayPal is not configured on this server");
        }
    }

    private OrderRequest buildPayPalOrderRequest(String amount, String currency, String orderRef) {
        OrderRequest orderRequest = new OrderRequest();
        orderRequest.checkoutPaymentIntent("CAPTURE");

        Money money = new Money().currencyCode(currency).value(amount);
        AmountBreakdown breakdown = new AmountBreakdown().itemTotal(money);
        AmountWithBreakdown amountWithBreakdown = new AmountWithBreakdown()
                .currencyCode(currency)
                .value(amount)
                .amountBreakdown(breakdown);

        PurchaseUnitRequest unit = new PurchaseUnitRequest()
                .amountWithBreakdown(amountWithBreakdown)
                .customId(orderRef);   // correlates PayPal order to internal order

        orderRequest.purchaseUnits(List.of(unit));
        orderRequest.applicationContext(
                new ApplicationContext()
                        .brandName("Shop")
                        .landingPage("BILLING")
                        .userAction("PAY_NOW")
                        .shippingPreference("NO_SHIPPING")
        );
        return orderRequest;
    }

    private void persistPayPalOrderId(Long orderId, String paypalOrderId, String currency) {
        Map<String, Object> meta = new HashMap<>();
        meta.put("paypalOrderId", paypalOrderId);
        meta.put("currency", currency);
        jdbcTemplate.update(
                """
                UPDATE payments
                SET payment_reference = ?,
                    provider = 'paypal',
                    method = 'PAYPAL',
                    metadata = ?::jsonb,
                    updated_at = CURRENT_TIMESTAMP
                WHERE order_id = ?
                """,
                paypalOrderId, writeJson(meta), orderId
        );
    }

    private CaptureDetails extractCaptureDetails(Order capturedOrder) {
        try {
            if (capturedOrder.purchaseUnits() == null || capturedOrder.purchaseUnits().isEmpty()) {
                return new CaptureDetails(null, null, null, null);
            }
            var payments = capturedOrder.purchaseUnits().get(0).payments();
            if (payments == null || payments.captures() == null || payments.captures().isEmpty()) {
                return new CaptureDetails(null, null, null, null);
            }
            Capture capture = payments.captures().get(0);
            String captureId = capture.id();
            String status = capture.status();
            String amount = capture.amount() != null ? capture.amount().value() : null;
            String payerEmail = capturedOrder.payer() != null
                    ? capturedOrder.payer().email() : null;
            return new CaptureDetails(captureId, status, amount, payerEmail);
        } catch (Exception e) {
            log.warn("[PayPal] Failed to extract capture details: {}", e.getMessage());
            return new CaptureDetails(null, null, null, null);
        }
    }

    private void updateOrderStatus(Long orderId, String orderStatus, String paymentStatus) {
        jdbcTemplate.update(
                """
                UPDATE orders
                SET payment_status = ?,
                    order_status   = ?,
                    updated_at     = CURRENT_TIMESTAMP
                WHERE id = ?
                """,
                paymentStatus, orderStatus, orderId
        );
    }

    private void updatePaymentRecord(Long orderId,
                                     String paypalOrderId,
                                     CaptureDetails details,
                                     String paymentStatus,
                                     boolean paid) {
        Map<String, Object> meta = new HashMap<>();
        meta.put("paypalOrderId", paypalOrderId);
        meta.put("captureId", details.captureId());
        meta.put("captureStatus", details.status());
        meta.put("payerEmail", details.payerEmail());
        if (details.amount() != null) {
            meta.put("capturedAmount", details.amount());
        }

        jdbcTemplate.update(
                """
                UPDATE payments
                SET provider            = 'paypal',
                    method              = 'PAYPAL',
                    payment_reference   = ?,
                    paypal_order_id     = ?,
                    paypal_capture_id   = ?,
                    payer_email         = ?,
                    status              = ?,
                    paid_at             = ?,
                    metadata            = ?::jsonb,
                    updated_at          = CURRENT_TIMESTAMP
                WHERE order_id = ?
                """,
                details.captureId() != null ? details.captureId() : paypalOrderId,
                paypalOrderId,
                details.captureId(),
                details.payerEmail(),
                paymentStatus,
                paid ? new Timestamp(System.currentTimeMillis()) : null,
                writeJson(meta),
                orderId
        );
    }

    private boolean tryAcquireIdempotencyLock(String provider, String eventKey, String orderNumber) {
        int inserted = jdbcTemplate.update(
                """
                INSERT INTO payment_webhook_events (provider, event_key, order_number, payload)
                VALUES (?, ?, ?, ?::jsonb)
                ON CONFLICT (provider, event_key) DO NOTHING
                """,
                provider, eventKey, orderNumber,
                writeJson(Map.of("paypalOrderId", eventKey, "orderNumber", orderNumber))
        );
        return inserted > 0;
    }

    private void releaseIdempotencyLock(String provider, String eventKey) {
        try {
            jdbcTemplate.update(
                    "DELETE FROM payment_webhook_events WHERE provider = ? AND event_key = ?",
                    provider, eventKey
            );
        } catch (Exception ex) {
            log.warn("[PayPal] Failed to release idempotency lock for eventKey={}: {}", eventKey, ex.getMessage());
        }
    }

    private void triggerPostPaymentActions(OrderSnapshot order) {
        try {
            couponService.redeemCouponForPaidOrder(order.id());
        } catch (Exception ex) {
            log.error("[PayPal] Post-payment coupon redeem failed for order {}", order.id(), ex);
        }
        try {
            sendPaidNotification(order.id());
        } catch (Exception ex) {
            log.error("[PayPal] Post-payment email notification failed for order {}", order.id(), ex);
        }
        try {
            publishStatusChangedEvent(order, "paid", "paid");
        } catch (Exception ex) {
            log.error("[PayPal] Status-change event publish failed for order {}", order.id(), ex);
        }
    }

    private void sendPaidNotification(Long orderId) {
        OrderSnapshot order = jdbcTemplate.query(
                """
                SELECT o.id, o.order_number, o.customer_email,
                       o.customer_first_name, o.customer_last_name,
                       o.customer_phone,
                       o.shipping_address_line1, o.shipping_address_line2,
                       o.shipping_city, o.shipping_state,
                       o.shipping_postal_code, o.shipping_country,
                       o.notes, o.subtotal, o.shipping_fee,
                       o.vat, o.total_amount, o.currency,
                       o.payment_method, o.order_status, o.payment_status,
                       p.metadata AS payment_metadata
                FROM orders o
                LEFT JOIN payments p ON p.order_id = o.id
                WHERE o.id = ? LIMIT 1
                """,
                this::mapOrderSnapshot, orderId
        ).stream().findFirst().orElse(null);

        if (order == null) return;

        List<OrderPaidEmailRequest.Item> items = jdbcTemplate.query(
                """
                SELECT product_id, product_name, unit_price, quantity, line_total
                FROM order_items WHERE order_id = ? ORDER BY id ASC
                """,
                (rs, idx) -> {
                    OrderPaidEmailRequest.Item item = new OrderPaidEmailRequest.Item();
                    item.setProductID(rs.getString("product_id"));
                    item.setProductName(rs.getString("product_name"));
                    item.setUnitPrice(rs.getDouble("unit_price"));
                    item.setQuantity(rs.getInt("quantity"));
                    item.setLineTotal(rs.getDouble("line_total"));
                    return item;
                },
                orderId
        );

        OrderPaidEmailRequest mail = new OrderPaidEmailRequest();
        mail.setTo(order.customerEmail());
        mail.setOrderNumber(order.orderNumber());
        mail.setCurrency(order.currency());
        mail.setSubtotal(toDouble(order.subtotal()));
        mail.setShippingFee(toDouble(order.shippingFee()));
        mail.setVat(toDouble(order.vat()));
        mail.setTotalAmount(toDouble(order.totalAmount()));
        mail.setPaymentMethod("PAYPAL");
        mail.setCustomerEmail(order.customerEmail());
        mail.setCustomerFirstName(order.customerFirstName());
        mail.setCustomerLastName(order.customerLastName());
        mail.setCustomerPhone(order.customerPhone());
        mail.setShippingAddressLine1(order.shippingAddressLine1());
        mail.setShippingAddressLine2(order.shippingAddressLine2());
        mail.setShippingCity(order.shippingCity());
        mail.setShippingState(order.shippingState());
        mail.setShippingPostalCode(order.shippingPostalCode());
        mail.setShippingCountry(order.shippingCountry());
        mail.setNotes(order.notes());
        mail.setItems(items);
        orderPaidEmailMessagePublisher.publish(mail);
    }

    private void publishStatusChangedEvent(OrderSnapshot order,
                                           String newOrderStatus,
                                           String newPaymentStatus) {
        String customerName = (safe(order.customerFirstName())
                + " " + safe(order.customerLastName())).trim();
        orderStatusChangedPublisher.publish(OrderStatusChangedEvent.builder()
                .orderId(order.id())
                .orderNumber(order.orderNumber())
                .customerEmail(order.customerEmail())
                .customerName(customerName)
                .oldStatus(order.orderStatus())
                .newStatus(newOrderStatus)
                .oldPaymentStatus(order.paymentStatus())
                .newPaymentStatus(newPaymentStatus)
                .build());
    }

    private OrderSnapshot findOrderByOrderNumber(String orderNumber) {
        List<OrderSnapshot> rows = jdbcTemplate.query(
                """
                SELECT o.id, o.order_number, o.customer_email,
                       o.customer_first_name, o.customer_last_name,
                       o.customer_phone,
                       o.shipping_address_line1, o.shipping_address_line2,
                       o.shipping_city, o.shipping_state,
                       o.shipping_postal_code, o.shipping_country,
                       o.notes, o.subtotal, o.shipping_fee,
                       o.vat, o.total_amount, o.currency,
                       o.payment_method, o.order_status, o.payment_status,
                       p.metadata AS payment_metadata
                FROM orders o
                LEFT JOIN payments p ON p.order_id = o.id
                WHERE o.order_number = ? LIMIT 1
                """,
                this::mapOrderSnapshot, orderNumber
        );
        return rows.isEmpty() ? null : rows.getFirst();
    }

    private OrderSnapshot mapOrderSnapshot(ResultSet rs, int rowNum) throws SQLException {
        return new OrderSnapshot(
                rs.getLong("id"),
                rs.getString("order_number"),
                rs.getString("customer_email"),
                rs.getString("customer_first_name"),
                rs.getString("customer_last_name"),
                rs.getString("customer_phone"),
                rs.getString("shipping_address_line1"),
                rs.getString("shipping_address_line2"),
                rs.getString("shipping_city"),
                rs.getString("shipping_state"),
                rs.getString("shipping_postal_code"),
                rs.getString("shipping_country"),
                rs.getString("notes"),
                rs.getBigDecimal("subtotal"),
                rs.getBigDecimal("shipping_fee"),
                rs.getBigDecimal("vat"),
                rs.getBigDecimal("total_amount"),
                rs.getString("currency"),
                rs.getString("payment_method"),
                rs.getString("order_status"),
                rs.getString("payment_status"),
                rs.getString("payment_metadata")
        );
    }

    // ──────────────────────────────────────────────────────────────────────────
    //  Utility helpers
    // ──────────────────────────────────────────────────────────────────────────

    private String writeJson(Object value) {
        try {
            return objectMapper.writeValueAsString(value);
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("Failed to serialize JSON", e);
        }
    }

    private Map<String, Object> parseMetadata(String raw) {
        if (!StringUtils.hasText(raw)) return new HashMap<>();
        try {
            Map<String, Object> parsed = objectMapper.readValue(raw, new TypeReference<>() {});
            return parsed == null ? new HashMap<>() : new HashMap<>(parsed);
        } catch (Exception ignored) {
            return new HashMap<>();
        }
    }

    private double toDouble(BigDecimal v) {
        return v == null ? 0D : v.doubleValue();
    }

    private String safe(String v) {
        return v == null ? "" : v.trim();
    }

    // ──────────────────────────────────────────────────────────────────────────
    //  Internal records
    // ──────────────────────────────────────────────────────────────────────────

    private record OrderSnapshot(
            Long id,
            String orderNumber,
            String customerEmail,
            String customerFirstName,
            String customerLastName,
            String customerPhone,
            String shippingAddressLine1,
            String shippingAddressLine2,
            String shippingCity,
            String shippingState,
            String shippingPostalCode,
            String shippingCountry,
            String notes,
            BigDecimal subtotal,
            BigDecimal shippingFee,
            BigDecimal vat,
            BigDecimal totalAmount,
            String currency,
            String paymentMethod,
            String orderStatus,
            String paymentStatus,
            String paymentMetadata
    ) {}

    private record CaptureDetails(
            String captureId,
            String status,
            String amount,
            String payerEmail
    ) {}
}
