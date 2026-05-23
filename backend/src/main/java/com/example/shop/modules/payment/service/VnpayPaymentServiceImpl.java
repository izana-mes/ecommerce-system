package com.example.shop.modules.payment.service;

import com.example.shop.common.observability.ObservabilityMetrics;
import com.example.shop.modules.coupon.service.CouponService;
import com.example.shop.modules.inventory.service.InventoryReservationService;
import com.example.shop.modules.messaging.notification.OrderPaidEmailMessagePublisher;
import com.example.shop.modules.messaging.order.OrderStatusChangedEvent;
import com.example.shop.modules.messaging.order.OrderStatusChangedPublisher;
import com.example.shop.modules.messaging.payment.PaymentIpnMessagePublisher;
import com.example.shop.modules.messaging.payment.VnpayIpnMessage;
import com.example.shop.modules.notification.dto.OrderPaidEmailRequest;
import com.example.shop.modules.payment.dto.VnpayIpnResponse;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.security.InvalidKeyException;
import java.security.NoSuchAlgorithmException;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class VnpayPaymentServiceImpl implements VnpayPaymentService {

    private final JdbcTemplate jdbcTemplate;
    private final ObjectMapper objectMapper;
    private final PaymentIpnMessagePublisher paymentIpnMessagePublisher;
    private final OrderPaidEmailMessagePublisher orderPaidEmailMessagePublisher;
    private final OrderStatusChangedPublisher orderStatusChangedPublisher;
    private final CouponService couponService;
    private final InventoryReservationService inventoryReservationService;
    private final ObservabilityMetrics observabilityMetrics;

    @Value("${application.payment.vnpay.hash-secret:}")
    private String hashSecret;

    /** Multiplier from order currency (USD) to VND. Must match VNPAY_USD_TO_VND_RATE set in frontend. */
    @Value("${application.payment.vnpay.usd-to-vnd-rate:26000}")
    private long usdToVndRate;

    @Override
    public VnpayIpnResponse enqueueIpn(Map<String, String> params) {
        if (params == null || params.isEmpty()) {
            return new VnpayIpnResponse("99", "Invalid request");
        }
        if (!StringUtils.hasText(params.get("vnp_TxnRef")) || !StringUtils.hasText(params.get("vnp_SecureHash"))) {
            return new VnpayIpnResponse("99", "Invalid request");
        }
        boolean queued = paymentIpnMessagePublisher.tryPublish(VnpayIpnMessage.builder()
                .params(new HashMap<>(params))
                .build());
        if (queued) {
            return new VnpayIpnResponse("00", "Accepted");
        }
        log.info("RabbitMQ unavailable; processing VNPAY IPN synchronously for {}", params.get("vnp_TxnRef"));
        return processIpn(params);
    }

    @Override
    @Transactional
    public VnpayIpnResponse processIpn(Map<String, String> params) {
        long startedAt = System.currentTimeMillis();
        String metricStatus = "error";
        try {
            if (!StringUtils.hasText(hashSecret)) {
                metricStatus = "missing_config";
                return new VnpayIpnResponse("99", "Missing config");
            }

        String secureHash = params.get("vnp_SecureHash");
        String txnRef = params.get("vnp_TxnRef");
        long amount = parseLong(params.get("vnp_Amount"));
        String responseCode = safe(params.get("vnp_ResponseCode"));
        String transactionStatus = safe(params.get("vnp_TransactionStatus"));
        String transactionNo = safe(params.get("vnp_TransactionNo"));

        log.info("Processing VNPAY IPN for order {}: responseCode={}, transactionStatus={}", 
                txnRef, responseCode, transactionStatus);

        if (!StringUtils.hasText(secureHash) || !StringUtils.hasText(txnRef)) {
            metricStatus = "invalid_request";
            return new VnpayIpnResponse("99", "Invalid request");
        }
        
        // ... (existing code for hash check and order snapshot)

        Map<String, String> payload = new HashMap<>(params);
        payload.remove("vnp_SecureHash");
        payload.remove("vnp_SecureHashType");

        String computedHash;
        try {
            computedHash = createVnpSecureHash(payload, hashSecret);
        } catch (Exception e) {
            log.error("Failed to compute VNPAY hash", e);
            metricStatus = "hash_error";
            return new VnpayIpnResponse("99", "Hash error");
        }

        if (!computedHash.equalsIgnoreCase(secureHash)) {
            metricStatus = "invalid_signature";
            return new VnpayIpnResponse("97", "Invalid signature");
        }

        OrderSnapshot order = findOrderByOrderNumber(txnRef);
        if (order == null) {
            metricStatus = "order_not_found";
            return new VnpayIpnResponse("01", "Order not found");
        }

        // vnp_Amount from VNPAY is always in VND × 100.
        // DB stores totalAmount in the order's currency (typically USD).
        // Convert to VND cents for comparison.
        String orderCurrency = order.currency() == null ? "USD" : order.currency().toUpperCase();
        long expectedVndCents;
        if ("VND".equals(orderCurrency)) {
            expectedVndCents = order.totalAmount().multiply(BigDecimal.valueOf(100)).longValue();
        } else if ("USD".equals(orderCurrency)) {
            expectedVndCents = order.totalAmount()
                    .multiply(BigDecimal.valueOf(usdToVndRate))
                    .multiply(BigDecimal.valueOf(100))
                    .longValue();
        } else {
            log.warn("processIpn: unsupported currency {} for order {}, skipping amount check", orderCurrency, txnRef);
            expectedVndCents = amount; // skip check
        }

        boolean amountMatched = (expectedVndCents == amount);
        if (!amountMatched) {
            log.warn("processIpn: amount mismatch for order {} – expected {} VND-cents, got {} from VNPAY",
                    txnRef, expectedVndCents, amount);
        }

        if ("paid".equalsIgnoreCase(order.paymentStatus())) {
            metricStatus = "already_paid";
            return new VnpayIpnResponse("02", "Order already confirmed");
        }

        String eventKey = safe(params.get("vnp_TransactionNo"));
        if (!StringUtils.hasText(eventKey)) {
            eventKey = txnRef + "-" + responseCode + "-" + transactionStatus;
        }

        if (!tryAcquireWebhookIdempotency("vnpay", eventKey, txnRef, payload)) {
            metricStatus = "duplicate_event";
            return new VnpayIpnResponse("02", "Event already processed");
        }

        boolean paid = "00".equals(responseCode) && "00".equals(transactionStatus);
        String paymentStatus = paid ? "paid" : "failed";
        String orderStatus = paid ? "paid" : "cancelled";

        jdbcTemplate.update(
                "UPDATE orders SET payment_status = ?, order_status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
                paymentStatus,
                orderStatus,
                order.id()
        );

        Map<String, Object> existingMetadata = parsePaymentMetadata(order.paymentMetadata());
        existingMetadata.put("ipn", payload);
        existingMetadata.put("amountCheck", Map.of(
                "matched", amountMatched,
                "expectedVndCents", expectedVndCents,
                "receivedVndCents", amount
        ));

        jdbcTemplate.update(
                """
                        UPDATE payments
                        SET provider = 'vnpay',
                            method = 'VNPAY',
                            payment_reference = ?,
                            status = ?,
                            paid_at = ?,
                            metadata = ?::jsonb,
                            updated_at = CURRENT_TIMESTAMP
                        WHERE order_id = ?
                        """,
                StringUtils.hasText(transactionNo) ? transactionNo : txnRef,
                paymentStatus,
                paid ? new Timestamp(System.currentTimeMillis()) : null,
                writeJson(existingMetadata),
                order.id()
        );

        if (paid) {
            metricStatus = "paid";
            try {
                inventoryReservationService.confirmByOrderNumber(order.orderNumber());
            } catch (Exception ex) {
                log.warn("Reservation confirm skipped for order {}: {}", order.orderNumber(), ex.getMessage());
            }
            log.info("VNPAY payment successful for order {}", order.id());
            try {
                couponService.redeemCouponForPaidOrder(order.id());
            } catch (Exception ex) {
                log.error("VNPAY post-payment coupon redeem failed for order {}", order.id(), ex);
            }
            log.info("Sending payment success notification for order {}", order.id());
            try {
                sendPaidNotification(order.id());
            } catch (Exception ex) {
                log.error("VNPAY post-payment notification failed for order {}", order.id(), ex);
            }
            try {
                publishStatusChangedEvent(order, orderStatus, paymentStatus);
            } catch (Exception ex) {
                log.error("VNPAY status-change event publish failed for order {}", order.id(), ex);
            }
        } else {
            metricStatus = "failed";
            try {
                inventoryReservationService.releaseByOrderNumber(order.orderNumber(), "payment_failed");
            } catch (Exception ex) {
                log.warn("Reservation release skipped for order {}: {}", order.orderNumber(), ex.getMessage());
            }
            log.warn("VNPAY payment failed or pending for order {}: responseCode={}, transactionStatus={}",
                    order.id(), responseCode, transactionStatus);
            try {
                publishStatusChangedEvent(order, orderStatus, paymentStatus);
            } catch (Exception ex) {
                log.error("VNPAY status-change event publish failed for order {}", order.id(), ex);
            }
        }

            return new VnpayIpnResponse("00", "Confirm Success");
        } finally {
            observabilityMetrics.recordPaymentIpn("vnpay", metricStatus, System.currentTimeMillis() - startedAt);
        }
    }

    private OrderSnapshot findOrderByOrderNumber(String orderNumber) {
        List<OrderSnapshot> rows = jdbcTemplate.query(
                """
                        SELECT o.id,
                               o.order_number,
                               o.customer_email,
                               o.customer_first_name,
                               o.customer_last_name,
                               o.customer_phone,
                               o.shipping_address_line1,
                               o.shipping_address_line2,
                               o.shipping_city,
                               o.shipping_state,
                               o.shipping_postal_code,
                               o.shipping_country,
                               o.notes,
                               o.subtotal,
                               o.shipping_fee,
                               o.vat,
                               o.total_amount,
                               o.currency,
                               o.payment_method,
                               o.order_status,
                               o.payment_status,
                               p.metadata AS payment_metadata
                        FROM orders o
                        LEFT JOIN payments p ON p.order_id = o.id
                        WHERE o.order_number = ?
                        LIMIT 1
                        """,
                this::mapOrderSnapshot,
                orderNumber
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

    private void sendPaidNotification(Long orderId) {
        OrderSnapshot order = jdbcTemplate.query(
                """
                        SELECT o.id,
                               o.order_number,
                               o.customer_email,
                               o.customer_first_name,
                               o.customer_last_name,
                               o.customer_phone,
                               o.shipping_address_line1,
                               o.shipping_address_line2,
                               o.shipping_city,
                               o.shipping_state,
                               o.shipping_postal_code,
                               o.shipping_country,
                               o.notes,
                               o.subtotal,
                               o.shipping_fee,
                               o.vat,
                               o.total_amount,
                               o.currency,
                               o.payment_method,
                               o.order_status,
                               o.payment_status,
                               p.metadata AS payment_metadata
                        FROM orders o
                        LEFT JOIN payments p ON p.order_id = o.id
                        WHERE o.id = ?
                        LIMIT 1
                        """,
                this::mapOrderSnapshot,
                orderId
        ).stream().findFirst().orElse(null);

        if (order == null) {
            return;
        }

        List<OrderPaidEmailRequest.Item> items = jdbcTemplate.query(
                """
                        SELECT product_id, product_name, unit_price, quantity, line_total
                        FROM order_items
                        WHERE order_id = ?
                        ORDER BY id ASC
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
        mail.setPaymentMethod(order.paymentMethod());
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

    private boolean tryAcquireWebhookIdempotency(String provider,
                                                 String eventKey,
                                                 String orderNumber,
                                                 Map<String, String> payload) {
        int inserted = jdbcTemplate.update(
                """
                        INSERT INTO payment_webhook_events (provider, event_key, order_number, payload)
                        VALUES (?, ?, ?, ?::jsonb)
                        ON CONFLICT (provider, event_key) DO NOTHING
                        """,
                provider,
                eventKey,
                orderNumber,
                writeJson(payload)
        );
        return inserted > 0;
    }

    private Map<String, Object> parsePaymentMetadata(String raw) {
        if (!StringUtils.hasText(raw)) {
            return new HashMap<>();
        }
        try {
            Map<String, Object> parsed = objectMapper.readValue(raw, new TypeReference<>() {
            });
            return parsed == null ? new HashMap<>() : new HashMap<>(parsed);
        } catch (Exception ignored) {
            return new HashMap<>();
        }
    }

    private String writeJson(Object value) {
        try {
            return objectMapper.writeValueAsString(value);
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("Failed to serialize JSON payload", e);
        }
    }

    private String createVnpSecureHash(Map<String, String> params, String secret)
            throws NoSuchAlgorithmException, InvalidKeyException {
        String hashData = params.entrySet().stream()
                .filter(e -> StringUtils.hasText(e.getValue()))
                .sorted(Map.Entry.comparingByKey())
                .map(e -> percentEncode(e.getKey()) + "=" + percentEncode(e.getValue()))
                .collect(Collectors.joining("&"));

        Mac hmac = Mac.getInstance("HmacSHA512");
        SecretKeySpec keySpec = new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA512");
        hmac.init(keySpec);
        byte[] digest = hmac.doFinal(hashData.getBytes(StandardCharsets.UTF_8));

        StringBuilder builder = new StringBuilder(digest.length * 2);
        for (byte b : digest) {
            builder.append(String.format("%02x", b));
        }
        return builder.toString();
    }

    private String percentEncode(String value) {
        return java.net.URLEncoder.encode(safe(value), StandardCharsets.UTF_8)
                .replace("*", "%2A")
                .replace("%7E", "~");
    }

    private long parseLong(String value) {
        try {
            return Long.parseLong(safe(value));
        } catch (Exception ignored) {
            return 0L;
        }
    }

    private double toDouble(BigDecimal value) {
        return value == null ? 0D : value.doubleValue();
    }

    private String safe(String value) {
        return value == null ? "" : value.trim();
    }

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
    ) {
    }

    private void publishStatusChangedEvent(OrderSnapshot order, String newOrderStatus, String newPaymentStatus) {
        try {
            String customerName = (safe(order.customerFirstName()) + " " + safe(order.customerLastName())).trim();
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
        } catch (Exception ex) {
            log.warn("Failed to publish VNPAY status changed event for order {}: {}", order.orderNumber(), ex.getMessage());
        }
    }

    @Override
    public OrderPaidEmailRequest buildOrderPaidEmailRequest(Map<String, String> params) {
        if (params == null) return null;
        String txnRef = safe(params.get("vnp_TxnRef"));
        if (!StringUtils.hasText(txnRef)) return null;

        OrderSnapshot order = findOrderByOrderNumber(txnRef);
        if (order == null) return null;

        List<OrderPaidEmailRequest.Item> items = jdbcTemplate.query(
                """
                        SELECT product_id, product_name, unit_price, quantity, line_total
                        FROM order_items
                        WHERE order_id = ?
                        ORDER BY id ASC
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
                order.id()
        );

        OrderPaidEmailRequest mail = new OrderPaidEmailRequest();
        mail.setTo(order.customerEmail());
        mail.setOrderNumber(order.orderNumber());
        mail.setCurrency(order.currency());
        mail.setSubtotal(toDouble(order.subtotal()));
        mail.setShippingFee(toDouble(order.shippingFee()));
        mail.setVat(toDouble(order.vat()));
        mail.setTotalAmount(toDouble(order.totalAmount()));
        mail.setPaymentMethod(order.paymentMethod());
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
        return mail;
    }
}
