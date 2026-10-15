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
import com.example.shop.modules.payment.momo.dto.MomoCreatePaymentResponse;
import com.example.shop.modules.payment.momo.dto.MomoPaymentStatusResponse;
import com.example.shop.modules.user.entity.User;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.MediaType;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import org.springframework.web.client.RestClient;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.Duration;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
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
    private final RestClient restClient;

    public MomoPaymentServiceImpl(
            JdbcTemplate jdbcTemplate,
            ObjectMapper objectMapper,
            OrderPaidEmailMessagePublisher orderPaidEmailMessagePublisher,
            OrderStatusChangedPublisher orderStatusChangedPublisher,
            CouponService couponService,
            InventoryReservationService inventoryReservationService,
            ObservabilityMetrics observabilityMetrics,
            MomoProperties momoProperties) {
        this.jdbcTemplate = jdbcTemplate;
        this.objectMapper = objectMapper;
        this.orderPaidEmailMessagePublisher = orderPaidEmailMessagePublisher;
        this.orderStatusChangedPublisher = orderStatusChangedPublisher;
        this.couponService = couponService;
        this.inventoryReservationService = inventoryReservationService;
        this.observabilityMetrics = observabilityMetrics;
        this.momoProperties = momoProperties;

        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(Duration.ofMillis(momoProperties.getConnectTimeoutMs()));
        factory.setReadTimeout(Duration.ofMillis(momoProperties.getReadTimeoutMs()));
        this.restClient = RestClient.builder()
                .requestFactory(factory)
                .build();
    }

    @Override
    @Transactional
    public MomoCreatePaymentResponse createPayment(String orderNumber, User user) {
        if (!StringUtils.hasText(orderNumber)) {
            throw new IllegalArgumentException("Order number cannot be empty");
        }
        if (!momoProperties.isConfigured()) {
            throw new IllegalStateException("MoMo payment gateway is not configured on this server");
        }

        OrderSnapshot order = findOrderByOrderNumber(orderNumber.trim());
        if (order == null) {
            throw new IllegalArgumentException("Order not found: " + orderNumber);
        }

        if (user != null && StringUtils.hasText(order.customerEmail())) {
            if (!order.customerEmail().equalsIgnoreCase(user.getEmail())) {
                throw new AccessDeniedException("You do not have permission to pay for this order");
            }
        }

        if ("paid".equalsIgnoreCase(order.paymentStatus())) {
            throw new IllegalStateException("Order is already paid: " + orderNumber);
        }

        String orderCurrency = order.currency() == null ? "USD" : order.currency().toUpperCase();
        long amountVnd;
        if ("VND".equals(orderCurrency)) {
            amountVnd = order.totalAmount() == null ? 0L
                    : order.totalAmount().setScale(0, RoundingMode.HALF_UP).longValue();
        } else {
            amountVnd = MomoIpnSupport.toVndAmount(order.totalAmount(), momoProperties.getUsdToVndRate());
        }

        if (amountVnd < 1_000) {
            throw new IllegalArgumentException("MoMo order amount too low: " + amountVnd + " VND");
        }

        String requestId = UUID.randomUUID().toString().replace("-", "");
        String momoOrderId = orderNumber + "." + UUID.randomUUID().toString().replace("-", "");
        String orderInfo = "Thanh toan don hang " + orderNumber;
        String extraData = MomoIpnSupport.encodeOrderNumber(orderNumber);

        String partnerCode = momoProperties.getPartnerCode();
        String accessKey = momoProperties.getAccessKey();
        String secretKey = momoProperties.getSecretKey();
        String redirectUrl = momoProperties.getRedirectUrl();
        String ipnUrl = momoProperties.getIpnUrl();
        String requestType = StringUtils.hasText(momoProperties.getRequestType())
                ? momoProperties.getRequestType()
                : "payWithMethod";

        String rawSignature = MomoIpnSupport.buildCreateRawSignature(
                accessKey,
                amountVnd,
                extraData,
                ipnUrl,
                momoOrderId,
                orderInfo,
                partnerCode,
                redirectUrl,
                requestId,
                requestType
        );
        String signature = MomoIpnSupport.hmacSha256Hex(secretKey, rawSignature);

        Map<String, Object> requestBody = new LinkedHashMap<>();
        requestBody.put("partnerCode", partnerCode);
        requestBody.put("partnerName", momoProperties.getPartnerName());
        requestBody.put("storeId", momoProperties.getStoreId());
        requestBody.put("requestId", requestId);
        requestBody.put("amount", amountVnd);
        requestBody.put("orderId", momoOrderId);
        requestBody.put("orderInfo", orderInfo);
        requestBody.put("redirectUrl", redirectUrl);
        requestBody.put("ipnUrl", ipnUrl);
        requestBody.put("requestType", requestType);
        requestBody.put("extraData", extraData);
        requestBody.put("autoCapture", true);
        requestBody.put("lang", "vi");
        requestBody.put("signature", signature);

        log.info("[MoMo] Creating payment request: orderNumber={} momoOrderId={} requestId={} amountVnd={} requestType={}",
                orderNumber, momoOrderId, requestId, amountVnd, requestType);

        Map<String, Object> responseBody;
        try {
            responseBody = restClient.post()
                    .uri(momoProperties.getCreateUrl())
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(requestBody)
                    .retrieve()
                    .body(new ParameterizedTypeReference<>() {});
        } catch (Exception ex) {
            log.error("[MoMo] HTTP error contacting MoMo create gateway for order {}: {}", orderNumber, ex.getMessage());
            throw new IllegalStateException("Failed to communicate with MoMo payment gateway: " + ex.getMessage(), ex);
        }

        if (responseBody == null) {
            throw new IllegalStateException("Empty response from MoMo payment gateway");
        }

        int resultCode = parseInt(responseBody.get("resultCode"));
        String message = safeString(responseBody.get("message"));
        String payUrl = safeString(responseBody.get("payUrl"));
        String qrCodeUrl = safeString(responseBody.get("qrCodeUrl"));
        String deeplink = safeString(responseBody.get("deeplink"));

        log.info("[MoMo] Create payment result: orderNumber={} resultCode={} message={}",
                orderNumber, resultCode, message);

        if (resultCode != 0 || !StringUtils.hasText(payUrl)) {
            log.error("[MoMo] Payment creation rejected by MoMo: resultCode={} message={}", resultCode, message);
            throw new IllegalStateException("MoMo rejected payment creation: " + message + " (code " + resultCode + ")");
        }

        // Persist payment attempt in database
        Map<String, Object> paymentMeta = parsePaymentMetadata(order.paymentMetadata());
        paymentMeta.put("provider", "momo");
        paymentMeta.put("momoOrderId", momoOrderId);
        paymentMeta.put("requestId", requestId);
        paymentMeta.put("amountVnd", amountVnd);
        paymentMeta.put("requestType", requestType);

        int updated = jdbcTemplate.update(
                """
                UPDATE payments
                SET provider = 'momo',
                    method = 'MOMO',
                    payment_reference = ?,
                    status = 'pending',
                    metadata = ?::jsonb,
                    updated_at = CURRENT_TIMESTAMP
                WHERE order_id = ?
                """,
                momoOrderId, writeJson(paymentMeta), order.id()
        );

        if (updated == 0) {
            jdbcTemplate.update(
                    """
                    INSERT INTO payments (order_id, payment_reference, provider, method, amount, currency, status, metadata)
                    VALUES (?, ?, 'momo', 'MOMO', ?, ?, 'pending', ?::jsonb)
                    """,
                    order.id(), momoOrderId, order.totalAmount(), order.currency(), writeJson(paymentMeta)
            );
        }

        return MomoCreatePaymentResponse.builder()
                .success(true)
                .payUrl(payUrl)
                .qrCodeUrl(qrCodeUrl)
                .deeplink(deeplink)
                .orderId(momoOrderId)
                .requestId(requestId)
                .orderNumber(orderNumber)
                .amount(amountVnd)
                .resultCode(resultCode)
                .message(message)
                .build();
    }

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
                log.warn("[MoMo IPN] Missing accessKey/secretKey config");
                return;
            }

            String signature = safeString(payload.get("signature"));
            String momoOrderId = safeString(payload.get("orderId"));
            long amount = parseLong(payload.get("amount"));
            int resultCode = parseInt(payload.get("resultCode"));
            String transId = safeString(payload.get("transId"));
            String extraData = safeString(payload.get("extraData"));
            String shopOrderNumber = MomoIpnSupport.resolveOrderNumber(momoOrderId, extraData);

            log.info("[MoMo IPN] Received callback: resultCode={} transId={} momoOrderId={} shopOrder={} amount={}",
                    resultCode, transId, momoOrderId, shopOrderNumber, amount);

            if (!StringUtils.hasText(signature) || !StringUtils.hasText(momoOrderId)) {
                metricStatus = "invalid_request";
                log.warn("[MoMo IPN] Invalid payload (missing signature or orderId)");
                return;
            }

            String configuredPartner = momoProperties.getPartnerCode();
            String payloadPartner = safeString(payload.get("partnerCode"));
            if (StringUtils.hasText(configuredPartner) && !configuredPartner.equals(payloadPartner)) {
                metricStatus = "partner_mismatch";
                log.warn("[MoMo IPN] partnerCode mismatch for order {}", momoOrderId);
                return;
            }

            String rawSignature = MomoIpnSupport.buildIpnRawSignature(accessKey, payload);
            String computedHash;
            try {
                computedHash = MomoIpnSupport.hmacSha256Hex(secretKey, rawSignature);
            } catch (Exception e) {
                metricStatus = "hash_error";
                log.error("[MoMo IPN] Failed to compute HMAC-SHA256 hash", e);
                return;
            }

            if (!MomoIpnSupport.signaturesMatch(computedHash, signature)) {
                metricStatus = "invalid_signature";
                log.warn("[MoMo IPN] Invalid signature for order {}", momoOrderId);
                return;
            }

            OrderSnapshot order = findOrderByOrderNumber(shopOrderNumber);
            if (order == null) {
                metricStatus = "order_not_found";
                log.warn("[MoMo IPN] Order not found in database: momoOrderId={} shopOrder={}", momoOrderId, shopOrderNumber);
                return;
            }

            String orderCurrency = order.currency() == null ? "USD" : order.currency().toUpperCase();
            long expectedVndAmount;
            if ("VND".equals(orderCurrency)) {
                expectedVndAmount = order.totalAmount() == null ? 0L
                        : order.totalAmount().setScale(0, RoundingMode.HALF_UP).longValue();
            } else {
                expectedVndAmount = MomoIpnSupport.toVndAmount(order.totalAmount(), momoProperties.getUsdToVndRate());
            }

            if (expectedVndAmount != amount) {
                metricStatus = "amount_mismatch";
                log.warn("[MoMo IPN] Amount mismatch for order {} – expected {} VND, got {}",
                        shopOrderNumber, expectedVndAmount, amount);
                return;
            }

            if ("paid".equalsIgnoreCase(order.paymentStatus())) {
                metricStatus = "already_paid";
                log.info("[MoMo IPN] Order already confirmed paid: {}", shopOrderNumber);
                return;
            }

            String eventKey = momoOrderId + ":" + transId + ":" + resultCode;
            if (!tryAcquireWebhookIdempotency("momo", eventKey, shopOrderNumber, payload)) {
                metricStatus = "duplicate_event";
                log.info("[MoMo IPN] Duplicate webhook event ignored: {}", eventKey);
                return;
            }

            boolean paid = (resultCode == 0);
            if (!paid) {
                metricStatus = "failed";
                log.warn("[MoMo IPN] Payment failed or cancelled for order {}: resultCode={} transId={}",
                        shopOrderNumber, resultCode, transId);
                markOrderFailed(order, momoOrderId, transId, payload);
                return;
            }

            // Payment succeeded — apply state transitions atomically
            executePaymentSuccess(order, momoOrderId, transId, payload);
            metricStatus = "paid";
            log.info("[MoMo IPN] Successfully marked order {} as PAID (transId={})", shopOrderNumber, transId);

        } finally {
            observabilityMetrics.recordPaymentIpn("momo", metricStatus, System.currentTimeMillis() - startedAt);
        }
    }

    @Override
    @Transactional
    public MomoPaymentStatusResponse getPaymentStatus(String orderNumber) {
        if (!StringUtils.hasText(orderNumber)) {
            return MomoPaymentStatusResponse.builder()
                    .orderNumber(orderNumber)
                    .paymentStatus("unknown")
                    .orderStatus("unknown")
                    .paid(false)
                    .message("Missing order number")
                    .build();
        }

        OrderSnapshot order = findOrderByOrderNumber(orderNumber.trim());
        if (order == null) {
            return MomoPaymentStatusResponse.builder()
                    .orderNumber(orderNumber)
                    .paymentStatus("not_found")
                    .orderStatus("not_found")
                    .paid(false)
                    .message("Order not found")
                    .build();
        }

        if ("paid".equalsIgnoreCase(order.paymentStatus())) {
            return MomoPaymentStatusResponse.builder()
                    .orderNumber(order.orderNumber())
                    .paymentStatus(order.paymentStatus())
                    .orderStatus(order.orderStatus())
                    .paid(true)
                    .message("Payment successful")
                    .build();
        }

        // Order is still pending. Try querying MoMo server-to-server as active fallback.
        try {
            return queryMomoTransaction(orderNumber);
        } catch (Exception ex) {
            log.debug("[MoMo] Active query during status check skipped: {}", ex.getMessage());
            return MomoPaymentStatusResponse.builder()
                    .orderNumber(order.orderNumber())
                    .paymentStatus(order.paymentStatus())
                    .orderStatus(order.orderStatus())
                    .paid("paid".equalsIgnoreCase(order.paymentStatus()))
                    .message("Payment pending")
                    .build();
        }
    }

    @Override
    @Transactional
    public boolean processRedirect(Map<String, Object> params) {
        String secretKey = momoProperties.getSecretKey();
        String accessKey = momoProperties.getAccessKey();
        if (!StringUtils.hasText(secretKey) || !StringUtils.hasText(accessKey)) {
            log.warn("[MoMo Redirect] Missing accessKey/secretKey config");
            return false;
        }

        String signature = safeString(params.get("signature"));
        String momoOrderId = safeString(params.get("orderId"));
        long amount = parseLong(params.get("amount"));
        int resultCode = parseInt(params.get("resultCode"));
        String transId = safeString(params.get("transId"));
        String extraData = safeString(params.get("extraData"));
        String shopOrderNumber = MomoIpnSupport.resolveOrderNumber(momoOrderId, extraData);

        log.info("[MoMo Redirect] User redirected back: orderNumber={} resultCode={} transId={}",
                shopOrderNumber, resultCode, transId);

        if (!StringUtils.hasText(signature) || !StringUtils.hasText(momoOrderId)) {
            log.warn("[MoMo Redirect] Missing required parameters");
            return false;
        }

        // Validate redirect signature
        String rawSignature = MomoIpnSupport.buildIpnRawSignature(accessKey, params);
        String computedHash = MomoIpnSupport.hmacSha256Hex(secretKey, rawSignature);
        if (!MomoIpnSupport.signaturesMatch(computedHash, signature)) {
            log.warn("[MoMo Redirect] Invalid redirect signature for order {}", momoOrderId);
            return false;
        }

        OrderSnapshot order = findOrderByOrderNumber(shopOrderNumber);
        if (order == null) {
            log.warn("[MoMo Redirect] Order not found for redirect: {}", shopOrderNumber);
            return false;
        }

        if ("paid".equalsIgnoreCase(order.paymentStatus())) {
            log.info("[MoMo Redirect] Order already paid: {}", shopOrderNumber);
            return true;
        }

        if (resultCode != 0) {
            log.warn("[MoMo Redirect] User returned with failed/cancelled resultCode={}", resultCode);
            markOrderFailed(order, momoOrderId, transId, params);
            return false;
        }

        // Attempt server-to-server query to verify with MoMo directly
        try {
            MomoPaymentStatusResponse queryRes = queryMomoTransaction(shopOrderNumber);
            if (queryRes.isPaid()) {
                return true;
            }
        } catch (Exception ex) {
            log.warn("[MoMo Redirect] Server-to-server transaction query failed: {}", ex.getMessage());
        }

        // Fallback: If signature was valid, resultCode == 0, and amount matches, confirm payment idempotently
        String orderCurrency = order.currency() == null ? "USD" : order.currency().toUpperCase();
        long expectedVndAmount;
        if ("VND".equals(orderCurrency)) {
            expectedVndAmount = order.totalAmount() == null ? 0L
                    : order.totalAmount().setScale(0, RoundingMode.HALF_UP).longValue();
        } else {
            expectedVndAmount = MomoIpnSupport.toVndAmount(order.totalAmount(), momoProperties.getUsdToVndRate());
        }

        if (expectedVndAmount != amount) {
            log.warn("[MoMo Redirect] Amount mismatch on redirect: expected {} VND, got {}", expectedVndAmount, amount);
            return false;
        }

        String eventKey = momoOrderId + ":" + transId + ":redirect:" + resultCode;
        if (!tryAcquireWebhookIdempotency("momo_redirect", eventKey, shopOrderNumber, params)) {
            log.info("[MoMo Redirect] Event already processed: {}", eventKey);
            return true;
        }

        executePaymentSuccess(order, momoOrderId, transId, params);
        log.info("[MoMo Redirect] Confirmed order {} as PAID via cryptographically verified redirect", shopOrderNumber);
        return true;
    }

    @Override
    @Transactional
    public MomoPaymentStatusResponse queryMomoTransaction(String orderNumber) {
        if (!StringUtils.hasText(orderNumber) || !momoProperties.isConfigured()) {
            return MomoPaymentStatusResponse.builder()
                    .orderNumber(orderNumber)
                    .paymentStatus("unknown")
                    .paid(false)
                    .build();
        }

        OrderSnapshot order = findOrderByOrderNumber(orderNumber.trim());
        if (order == null) {
            return MomoPaymentStatusResponse.builder()
                    .orderNumber(orderNumber)
                    .paymentStatus("not_found")
                    .paid(false)
                    .build();
        }

        if ("paid".equalsIgnoreCase(order.paymentStatus())) {
            return MomoPaymentStatusResponse.builder()
                    .orderNumber(order.orderNumber())
                    .paymentStatus("paid")
                    .orderStatus(order.orderStatus())
                    .paid(true)
                    .message("Order already paid")
                    .build();
        }

        Map<String, Object> meta = parsePaymentMetadata(order.paymentMetadata());
        String momoOrderId = safeString(meta.get("momoOrderId"));
        String requestId = safeString(meta.get("requestId"));

        if (!StringUtils.hasText(momoOrderId) || !StringUtils.hasText(requestId)) {
            log.debug("[MoMo Query] No momoOrderId/requestId recorded for order {}", orderNumber);
            return MomoPaymentStatusResponse.builder()
                    .orderNumber(order.orderNumber())
                    .paymentStatus(order.paymentStatus())
                    .orderStatus(order.orderStatus())
                    .paid(false)
                    .build();
        }

        String partnerCode = momoProperties.getPartnerCode();
        String accessKey = momoProperties.getAccessKey();
        String secretKey = momoProperties.getSecretKey();

        String rawSignature = MomoIpnSupport.buildQueryRawSignature(accessKey, momoOrderId, partnerCode, requestId);
        String signature = MomoIpnSupport.hmacSha256Hex(secretKey, rawSignature);

        Map<String, Object> queryReq = new LinkedHashMap<>();
        queryReq.put("partnerCode", partnerCode);
        queryReq.put("requestId", requestId);
        queryReq.put("orderId", momoOrderId);
        queryReq.put("signature", signature);
        queryReq.put("lang", "vi");

        log.info("[MoMo Query] Querying MoMo status server-to-server for orderNumber={} momoOrderId={}",
                orderNumber, momoOrderId);

        Map<String, Object> queryResp;
        try {
            queryResp = restClient.post()
                    .uri(momoProperties.getQueryUrl())
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(queryReq)
                    .retrieve()
                    .body(new ParameterizedTypeReference<>() {});
        } catch (Exception ex) {
            log.warn("[MoMo Query] HTTP error querying MoMo gateway for order {}: {}", orderNumber, ex.getMessage());
            return MomoPaymentStatusResponse.builder()
                    .orderNumber(order.orderNumber())
                    .paymentStatus(order.paymentStatus())
                    .orderStatus(order.orderStatus())
                    .paid(false)
                    .message("Gateway query unreachable")
                    .build();
        }

        if (queryResp == null) {
            return MomoPaymentStatusResponse.builder()
                    .orderNumber(order.orderNumber())
                    .paymentStatus(order.paymentStatus())
                    .orderStatus(order.orderStatus())
                    .paid(false)
                    .build();
        }

        int resultCode = parseInt(queryResp.get("resultCode"));
        long amount = parseLong(queryResp.get("amount"));
        String transId = safeString(queryResp.get("transId"));
        String message = safeString(queryResp.get("message"));

        log.info("[MoMo Query] MoMo query response: orderNumber={} resultCode={} transId={} amount={}",
                orderNumber, resultCode, transId, amount);

        if (resultCode == 0) {
            String eventKey = momoOrderId + ":" + transId + ":query:" + resultCode;
            if (tryAcquireWebhookIdempotency("momo_query", eventKey, orderNumber, queryResp)) {
                executePaymentSuccess(order, momoOrderId, transId, queryResp);
                log.info("[MoMo Query] Successfully marked order {} as PAID via Query API", orderNumber);
            }
            return MomoPaymentStatusResponse.builder()
                    .orderNumber(order.orderNumber())
                    .momoOrderId(momoOrderId)
                    .paymentStatus("paid")
                    .orderStatus("paid")
                    .paid(true)
                    .transId(transId)
                    .amount(amount)
                    .message("Payment successful")
                    .build();
        }

        return MomoPaymentStatusResponse.builder()
                .orderNumber(order.orderNumber())
                .momoOrderId(momoOrderId)
                .paymentStatus(order.paymentStatus())
                .orderStatus(order.orderStatus())
                .paid(false)
                .message(message)
                .build();
    }

    private void executePaymentSuccess(
            OrderSnapshot order,
            String momoOrderId,
            String transId,
            Map<String, Object> payload) {
        String paymentStatus = "paid";
        String orderStatus = "paid";

        jdbcTemplate.update(
                "UPDATE orders SET payment_status = ?, order_status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
                paymentStatus,
                orderStatus,
                order.id()
        );

        Map<String, Object> existingMetadata = parsePaymentMetadata(order.paymentMetadata());
        existingMetadata.put("momoOrderId", momoOrderId);
        existingMetadata.put("transId", transId);
        existingMetadata.put("paidPayload", payload);

        jdbcTemplate.update(
                """
                UPDATE payments
                SET provider = 'momo',
                    method = 'MOMO',
                    payment_reference = ?,
                    status = ?,
                    paid_at = ?,
                    metadata = ?::jsonb,
                    updated_at = CURRENT_TIMESTAMP
                WHERE order_id = ?
                """,
                StringUtils.hasText(transId) ? transId : momoOrderId,
                paymentStatus,
                new Timestamp(System.currentTimeMillis()),
                writeJson(existingMetadata),
                order.id()
        );

        try {
            inventoryReservationService.confirmByOrderNumber(order.orderNumber());
        } catch (Exception ex) {
            log.warn("[MoMo] Inventory reservation confirm skipped for order {}: {}", order.orderNumber(), ex.getMessage());
        }

        try {
            couponService.redeemCouponForPaidOrder(order.id());
        } catch (Exception ex) {
            log.warn("[MoMo] Coupon redeem skipped for order {}: {}", order.orderNumber(), ex.getMessage());
        }

        sendPaidNotification(order.id());
        publishStatusChangedEvent(order, orderStatus, paymentStatus);
    }

    private void markOrderFailed(
            OrderSnapshot order,
            String momoOrderId,
            String transId,
            Map<String, Object> payload) {
        if ("paid".equalsIgnoreCase(order.paymentStatus())) {
            return;
        }

        jdbcTemplate.update(
                "UPDATE orders SET payment_status = 'failed', updated_at = CURRENT_TIMESTAMP WHERE id = ?",
                order.id()
        );

        Map<String, Object> failedMetadata = parsePaymentMetadata(order.paymentMetadata());
        failedMetadata.put("momoOrderId", momoOrderId);
        failedMetadata.put("transId", transId);
        failedMetadata.put("failedPayload", payload);

        jdbcTemplate.update(
                """
                UPDATE payments
                SET provider = 'momo',
                    method = 'MOMO',
                    payment_reference = ?,
                    status = 'failed',
                    metadata = ?::jsonb,
                    updated_at = CURRENT_TIMESTAMP
                WHERE order_id = ?
                """,
                StringUtils.hasText(transId) ? transId : momoOrderId,
                writeJson(failedMetadata),
                order.id()
        );

        publishStatusChangedEvent(order, order.orderStatus(), "failed");
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
                rs.getString("payment_method"), rs.getString("order_status"), rs.getString("payment_status"),
                rs.getString("payment_metadata")
        );
    }

    private void sendPaidNotification(Long orderId) {
        OrderSnapshot order = jdbcTemplate.query(
                """
                SELECT o.id, o.order_number, o.customer_email, o.customer_first_name, o.customer_last_name,
                       o.customer_phone, o.shipping_address_line1, o.shipping_address_line2, o.shipping_city,
                       o.shipping_state, o.shipping_postal_code, o.shipping_country, o.notes, o.subtotal,
                       o.shipping_fee, o.vat, o.total_amount, o.currency, o.payment_method, o.order_status,
                       o.payment_status, p.metadata AS payment_metadata
                FROM orders o
                LEFT JOIN payments p ON p.order_id = o.id
                WHERE o.id = ?
                LIMIT 1
                """,
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
            log.warn("[MoMo] Failed to publish status changed event for order {}: {}", order.orderNumber(), ex.getMessage());
        }
    }
}
