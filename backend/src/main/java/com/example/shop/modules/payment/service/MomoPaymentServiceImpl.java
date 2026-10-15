package com.example.shop.modules.payment.service;

import com.example.shop.common.observability.ObservabilityMetrics;
import com.example.shop.modules.coupon.service.CouponService;
import com.example.shop.modules.inventory.service.InventoryReservationService;
import com.example.shop.modules.messaging.notification.OrderPaidEmailMessagePublisher;
import com.example.shop.modules.messaging.order.OrderStatusChangedEvent;
import com.example.shop.modules.messaging.order.OrderStatusChangedPublisher;
import com.example.shop.modules.notification.dto.OrderPaidEmailRequest;
import com.example.shop.modules.payment.momo.MomoIpnSupport;
import com.example.shop.modules.payment.momo.MomoProperties;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.math.BigDecimal;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
@Slf4j
public class MomoPaymentServiceImpl implements MomoPaymentService {

    private final JdbcTemplate jdbcTemplate;
    private final ObjectMapper objectMapper;
    private final OrderPaidEmailMessagePublisher orderPaidEmailMessagePublisher;
    private final OrderStatusChangedPublisher orderStatusChangedPublisher;
    private final CouponService couponService;
    private final InventoryReservationService inventoryReservationService;
    private final ObservabilityMetrics observabilityMetrics;
    private final MomoProperties momoProperties;

    @Override
    @Transactional
    public void processIpn(Map<String, Object> payload) {
        long startedAt = System.currentTimeMillis();
        String metricStatus = "error";
        try {
            String secretKey = momoProperties.getSecretKey();
            String accessKey = momoProperties.getAccessKey();
            if (!StringUtils.hasText(secretKey) || !StringUtils.hasText(accessKey)) {
                metricStatus = "missing_config";
                log.warn("Momo IPN: Missing accessKey/secretKey config");
                return;
            }

        String signature = safeString(payload.get("signature"));
        String momoOrderId = safeString(payload.get("orderId"));
        long amount = parseLong(payload.get("amount"));
        int resultCode = parseInt(payload.get("resultCode"));
        String transId = safeString(payload.get("transId"));
        String extraData = safeString(payload.get("extraData"));
        String shopOrderNumber = MomoIpnSupport.resolveOrderNumber(momoOrderId, extraData);

        log.info("Momo IPN received resultCode={} message={} transId={} orderId={} shopOrder={} amount={}",
                resultCode, payload.get("message"), transId, momoOrderId, shopOrderNumber, amount);

        if (!StringUtils.hasText(signature) || !StringUtils.hasText(momoOrderId)) {
            metricStatus = "invalid_request";
            log.warn("Momo IPN: Invalid payload (missing signature or orderId)");
            return;
        }

        String configuredPartner = momoProperties.getPartnerCode();
        String payloadPartner = safeString(payload.get("partnerCode"));
        if (StringUtils.hasText(configuredPartner) && !configuredPartner.equals(payloadPartner)) {
            metricStatus = "partner_mismatch";
            log.warn("Momo IPN: partnerCode mismatch for order {}", momoOrderId);
            return;
        }

        String rawSignature = MomoIpnSupport.buildIpnRawSignature(accessKey, payload);
        String computedHash;
        try {
            computedHash = MomoIpnSupport.hmacSha256Hex(secretKey, rawSignature);
        } catch (Exception e) {
            metricStatus = "hash_error";
            log.error("Failed to compute MoMo hash", e);
            return;
        }

        if (!MomoIpnSupport.signaturesMatch(computedHash, signature)) {
            metricStatus = "invalid_signature";
            log.warn("Momo IPN: Invalid signature for order {}", momoOrderId);
            return;
        }

        OrderSnapshot order = findOrderByOrderNumber(shopOrderNumber);
        if (order == null) {
            metricStatus = "order_not_found";
            log.warn("Momo IPN: Order not found momoOrderId={} shopOrder={}", momoOrderId, shopOrderNumber);
            return;
        }

        String orderCurrency = order.currency() == null ? "USD" : order.currency().toUpperCase();
        long expectedVndAmount;
        if ("VND".equals(orderCurrency)) {
            expectedVndAmount = order.totalAmount() == null ? 0L : order.totalAmount().setScale(0, java.math.RoundingMode.HALF_UP).longValue();
        } else if ("USD".equals(orderCurrency)) {
            expectedVndAmount = MomoIpnSupport.toVndAmount(order.totalAmount(), momoProperties.getUsdToVndRate());
        } else {
            log.warn("Momo IPN: unsupported currency {} for order {}, skipping amount check", orderCurrency, shopOrderNumber);
            expectedVndAmount = amount;
        }

        if (expectedVndAmount != amount) {
            metricStatus = "amount_mismatch";
            log.warn("Momo IPN: amount mismatch for order {} – expected {} VND, got {}",
                    shopOrderNumber, expectedVndAmount, amount);
            return;
        }

        if ("paid".equalsIgnoreCase(order.paymentStatus())) {
             metricStatus = "already_paid";
             log.info("Momo IPN: Order already paid {}", shopOrderNumber);
             return;
        }

        String eventKey = momoOrderId + ":" + transId + ":" + resultCode;
        if (!tryAcquireWebhookIdempotency("momo", eventKey, shopOrderNumber, payload)) {
             metricStatus = "duplicate_event";
             log.info("Momo IPN: Event already processed {}", eventKey);
             return;
        }

        boolean paid = (resultCode == 0);
        if (!paid) {
            metricStatus = "failed";
            log.warn("Momo IPN: payment not successful shopOrder={} resultCode={} message={} transId={}",
                    shopOrderNumber, resultCode, payload.get("message"), transId);
            Map<String, Object> failedMetadata = parsePaymentMetadata(order.paymentMetadata());
            failedMetadata.put("ipn", payload);
            jdbcTemplate.update(
                    "UPDATE payments SET provider = 'momo', method = 'MOMO', payment_reference = ?, metadata = ?::jsonb, updated_at = CURRENT_TIMESTAMP WHERE order_id = ?",
                    StringUtils.hasText(transId) ? transId : momoOrderId,
                    writeJson(failedMetadata),
                    order.id()
            );
            return;
        }

        String paymentStatus = "paid";
        metricStatus = paymentStatus;
        String orderStatus = "paid";

        jdbcTemplate.update(
                "UPDATE orders SET payment_status = ?, order_status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
                paymentStatus,
                orderStatus,
                order.id()
        );

        Map<String, Object> existingMetadata = parsePaymentMetadata(order.paymentMetadata());
        existingMetadata.put("ipn", payload);

        jdbcTemplate.update(
                "UPDATE payments SET provider = 'momo', method = 'MOMO', payment_reference = ?, status = ?, paid_at = ?, metadata = ?::jsonb, updated_at = CURRENT_TIMESTAMP WHERE order_id = ?",
                StringUtils.hasText(transId) ? transId : momoOrderId,
                paymentStatus,
                new Timestamp(System.currentTimeMillis()),
                writeJson(existingMetadata),
                order.id()
        );

        try {
            inventoryReservationService.confirmByOrderNumber(order.orderNumber());
        } catch (Exception ex) {
            log.warn("Reservation confirm skipped for order {}: {}", order.orderNumber(), ex.getMessage());
        }
        couponService.redeemCouponForPaidOrder(order.id());
        sendPaidNotification(order.id());
        publishStatusChangedEvent(order, orderStatus, paymentStatus);

        log.info("Momo IPN: successfully processed order {} with status {}", shopOrderNumber, paymentStatus);
        } finally {
            observabilityMetrics.recordPaymentIpn("momo", metricStatus, System.currentTimeMillis() - startedAt);
        }
    }

    private OrderSnapshot findOrderByOrderNumber(String orderNumber) {
        List<OrderSnapshot> rows = jdbcTemplate.query(
                """
                        SELECT o.id, o.order_number, o.customer_email, o.customer_first_name, o.customer_last_name,
                               o.customer_phone, o.shipping_address_line1, o.shipping_address_line2, o.shipping_city,
                               o.shipping_state, o.shipping_postal_code, o.shipping_country, o.notes, o.subtotal,
                               o.shipping_fee, o.vat, o.total_amount, o.currency, o.payment_method, o.order_status, o.payment_status,
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
                rs.getLong("id"), rs.getString("order_number"), rs.getString("customer_email"),
                rs.getString("customer_first_name"), rs.getString("customer_last_name"), rs.getString("customer_phone"),
                rs.getString("shipping_address_line1"), rs.getString("shipping_address_line2"), rs.getString("shipping_city"),
                rs.getString("shipping_state"), rs.getString("shipping_postal_code"), rs.getString("shipping_country"),
                rs.getString("notes"), rs.getBigDecimal("subtotal"), rs.getBigDecimal("shipping_fee"),
                rs.getBigDecimal("vat"), rs.getBigDecimal("total_amount"), rs.getString("currency"),
                rs.getString("payment_method"), rs.getString("order_status"), rs.getString("payment_status"), rs.getString("payment_metadata")
        );
    }

    private void sendPaidNotification(Long orderId) {
        OrderSnapshot order = jdbcTemplate.query(
                "SELECT o.id, o.order_number, o.customer_email, o.customer_first_name, o.customer_last_name, o.customer_phone, o.shipping_address_line1, o.shipping_address_line2, o.shipping_city, o.shipping_state, o.shipping_postal_code, o.shipping_country, o.notes, o.subtotal, o.shipping_fee, o.vat, o.total_amount, o.currency, o.payment_method, o.order_status, o.payment_status, p.metadata AS payment_metadata FROM orders o LEFT JOIN payments p ON p.order_id = o.id WHERE o.id = ? LIMIT 1",
                this::mapOrderSnapshot,
                orderId
        ).stream().findFirst().orElse(null);

        if (order == null) return;

        List<OrderPaidEmailRequest.Item> items = jdbcTemplate.query(
                "SELECT product_id, product_name, unit_price, quantity, line_total FROM order_items WHERE order_id = ? ORDER BY id ASC",
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
        mail.setCurrency(order.currency() == null ? "USD" : order.currency());
        mail.setSubtotal(toDouble(order.subtotal()));
        mail.setShippingFee(toDouble(order.shippingFee()));
        mail.setVat(toDouble(order.vat()));
        mail.setTotalAmount(toDouble(order.totalAmount()));
        mail.setPaymentMethod(order.paymentMethod() == null ? "MOMO" : order.paymentMethod());
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

    private boolean tryAcquireWebhookIdempotency(String provider, String eventKey, String orderNumber, Map<String, Object> payload) {
        int inserted = jdbcTemplate.update(
                "INSERT INTO payment_webhook_events (provider, event_key, order_number, payload) VALUES (?, ?, ?, ?::jsonb) ON CONFLICT (provider, event_key) DO NOTHING",
                provider, eventKey, orderNumber, writeJson(payload));
        return inserted > 0;
    }

    private Map<String, Object> parsePaymentMetadata(String raw) {
        if (!StringUtils.hasText(raw)) return new HashMap<>();
        try {
            Map<String, Object> parsed = objectMapper.readValue(raw, new TypeReference<>() {});
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

    private String safeString(Object value) {
        return value == null ? "" : String.valueOf(value);
    }

    private long parseLong(Object value) {
        if (value instanceof Number) return ((Number) value).longValue();
        try {
            return Long.parseLong(safeString(value));
        } catch (Exception ignored) {
            return 0L;
        }
    }

    private int parseInt(Object value) {
        if (value instanceof Number) return ((Number) value).intValue();
        try {
            return Integer.parseInt(safeString(value));
        } catch (Exception ignored) {
            return -1;
        }
    }

    private double toDouble(BigDecimal value) {
        return value == null ? 0D : value.doubleValue();
    }

    private record OrderSnapshot(
            Long id, String orderNumber, String customerEmail, String customerFirstName, String customerLastName,
            String customerPhone, String shippingAddressLine1, String shippingAddressLine2, String shippingCity,
            String shippingState, String shippingPostalCode, String shippingCountry, String notes, BigDecimal subtotal,
            BigDecimal shippingFee, BigDecimal vat, BigDecimal totalAmount, String currency, String paymentMethod,
            String orderStatus, String paymentStatus, String paymentMetadata
    ) {}

    private void publishStatusChangedEvent(OrderSnapshot order, String newOrderStatus, String newPaymentStatus) {
        try {
            String customerName = (safeString(order.customerFirstName()).trim() + " " + safeString(order.customerLastName()).trim()).trim();
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
            log.warn("Failed to publish MoMo status changed event for order {}: {}", order.orderNumber(), ex.getMessage());
        }
    }

    public OrderPaidEmailRequest buildOrderPaidEmailRequest(Map<String, Object> payload) {
       return null;
    }
}
