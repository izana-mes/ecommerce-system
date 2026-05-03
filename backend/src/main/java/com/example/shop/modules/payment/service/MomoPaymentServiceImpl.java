package com.example.shop.modules.payment.service;

import com.example.shop.modules.coupon.service.CouponService;
import com.example.shop.modules.messaging.notification.OrderPaidEmailMessagePublisher;
import com.example.shop.modules.messaging.order.OrderStatusChangedEvent;
import com.example.shop.modules.messaging.order.OrderStatusChangedPublisher;
import com.example.shop.modules.notification.dto.OrderPaidEmailRequest;
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

    @Value("${application.payment.momo.secret-key:}")
    private String secretKey;

    @Value("${application.payment.momo.access-key:}")
    private String accessKey;

    @Value("${application.payment.momo.usd-to-vnd-rate:26000}")
    private long usdToVndRate;

    @Override
    @Transactional
    public void processIpn(Map<String, Object> payload) {
        if (!StringUtils.hasText(secretKey)) {
            log.warn("Momo IPN: Missing secretKey config");
            return;
        }

        String signature = safeString(payload.get("signature"));
        String orderIdStr = safeString(payload.get("orderId"));
        long amount = parseLong(payload.get("amount"));
        int resultCode = parseInt(payload.get("resultCode"));
        String transId = safeString(payload.get("transId"));

        if (!StringUtils.hasText(signature) || !StringUtils.hasText(orderIdStr)) {
            log.warn("Momo IPN: Invalid payload (missing signature or orderId)");
            return;
        }

        // Compute signature to verify
        // Formula: accessKey=$accessKey&amount=$amount&extraData=$extraData&message=$message&orderId=$orderId&orderInfo=$orderInfo&orderType=$orderType&partnerCode=$partnerCode&payType=$payType&requestId=$requestId&responseTime=$responseTime&resultCode=$resultCode&transId=$transId
        StringBuilder sb = new StringBuilder();
        sb.append("accessKey=").append(accessKey)
          .append("&amount=").append(amount)
          .append("&extraData=").append(safeString(payload.get("extraData")))
          .append("&message=").append(safeString(payload.get("message")))
          .append("&orderId=").append(orderIdStr)
          .append("&orderInfo=").append(safeString(payload.get("orderInfo")))
          .append("&orderType=").append(safeString(payload.get("orderType")))
          .append("&partnerCode=").append(safeString(payload.get("partnerCode")))
          .append("&payType=").append(safeString(payload.get("payType")))
          .append("&requestId=").append(safeString(payload.get("requestId")))
          .append("&responseTime=").append(safeString(payload.get("responseTime")))
          .append("&resultCode=").append(resultCode)
          .append("&transId=").append(transId);

        String computedHash;
        try {
            Mac hmac = Mac.getInstance("HmacSHA256");
            SecretKeySpec keySpec = new SecretKeySpec(secretKey.getBytes(StandardCharsets.UTF_8), "HmacSHA256");
            hmac.init(keySpec);
            byte[] digest = hmac.doFinal(sb.toString().getBytes(StandardCharsets.UTF_8));
            StringBuilder hexString = new StringBuilder(2 * digest.length);
            for (byte b : digest) {
                String hex = Integer.toHexString(0xff & b);
                if(hex.length() == 1) {
                    hexString.append('0');
                }
                hexString.append(hex);
            }
            computedHash = hexString.toString();
        } catch (Exception e) {
            log.error("Failed to compute MoMo hash", e);
            return;
        }

        if (!computedHash.equals(signature)) {
            log.warn("Momo IPN: Invalid signature for order {}", orderIdStr);
            return;
        }

        OrderSnapshot order = findOrderByOrderNumber(orderIdStr);
        if (order == null) {
            log.warn("Momo IPN: Order not found {}", orderIdStr);
            return;
        }

        // Currency check
        String orderCurrency = order.currency() == null ? "USD" : order.currency().toUpperCase();
        long expectedVndAmount;
        if ("VND".equals(orderCurrency)) {
            expectedVndAmount = order.totalAmount().longValue();
        } else if ("USD".equals(orderCurrency)) {
            expectedVndAmount = Math.round(order.totalAmount().doubleValue() * usdToVndRate);
        } else {
            log.warn("Momo IPN: unsupported currency {} for order {}, skipping amount check", orderCurrency, orderIdStr);
            expectedVndAmount = amount; // skip check
        }

        if (expectedVndAmount != amount) {
            log.warn("Momo IPN: amount mismatch for order {} – expected {} VND, got {}",
                    orderIdStr, expectedVndAmount, amount);
            return;
        }

        if ("paid".equalsIgnoreCase(order.paymentStatus())) {
             log.warn("Momo IPN: Order already paid {}", orderIdStr);
             return;
        }

        String eventKey = StringUtils.hasText(transId) ? transId : orderIdStr + "-" + resultCode;
        if (!tryAcquireWebhookIdempotency("momo", eventKey, orderIdStr, payload)) {
             log.warn("Momo IPN: Event already processed {}", eventKey);
             return;
        }

        boolean paid = (resultCode == 0);
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

        jdbcTemplate.update(
                "UPDATE payments SET provider = 'momo', method = 'MOMO', payment_reference = ?, status = ?, paid_at = ?, metadata = ?::jsonb, updated_at = CURRENT_TIMESTAMP WHERE order_id = ?",
                StringUtils.hasText(transId) ? transId : orderIdStr,
                paymentStatus,
                paid ? new Timestamp(System.currentTimeMillis()) : null,
                writeJson(existingMetadata),
                order.id()
        );

        if (paid) {
            couponService.redeemCouponForPaidOrder(order.id());
            sendPaidNotification(order.id());
        }
        publishStatusChangedEvent(order, orderStatus, paymentStatus);
        
        log.info("Momo IPN: successfully processed order {} with status {}", orderIdStr, paymentStatus);
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
       // Currently not returning anything, notification is sent synchronously in IPN processing.
       // Implemented just to fulfill interface if extended.
       return null;
    }
}
