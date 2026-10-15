package com.example.shop.modules.payment.momo;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Base64;
import java.util.Map;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

public final class MomoIpnSupport {

    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();

    private MomoIpnSupport() {}

    public static long toVndAmount(BigDecimal orderAmount, long usdToVndRate) {
        if (orderAmount == null) {
            return 0L;
        }
        return orderAmount
                .multiply(BigDecimal.valueOf(usdToVndRate))
                .setScale(0, RoundingMode.HALF_UP)
                .longValue();
    }

    public static String resolveOrderNumber(String momoOrderId, String extraData) {
        String fromExtra = decodeOrderNumber(extraData);
        if (fromExtra != null && !fromExtra.isBlank()) {
            return fromExtra;
        }
        return momoOrderId == null ? "" : momoOrderId;
    }

    public static String decodeOrderNumber(String extraData) {
        if (extraData == null || extraData.isBlank()) {
            return null;
        }
        try {
            byte[] decoded = Base64.getDecoder().decode(extraData);
            JsonNode node = OBJECT_MAPPER.readTree(decoded);
            JsonNode orderNumber = node.get("orderNumber");
            return orderNumber != null && orderNumber.isTextual() ? orderNumber.asText() : null;
        } catch (Exception ignored) {
            return null;
        }
    }

    /**
     * IPN/redirect signature raw string (MoMo One-Time Payments result).
     * Keys sorted a-z: accessKey, amount, extraData, message, orderId, orderInfo,
     * orderType, partnerCode, payType, requestId, responseTime, resultCode, transId.
     */
    public static String buildIpnRawSignature(String accessKey, Map<String, Object> payload) {
        return "accessKey=" + nullToEmpty(accessKey)
                + "&amount=" + stringify(payload.get("amount"))
                + "&extraData=" + stringify(payload.get("extraData"))
                + "&message=" + stringify(payload.get("message"))
                + "&orderId=" + stringify(payload.get("orderId"))
                + "&orderInfo=" + stringify(payload.get("orderInfo"))
                + "&orderType=" + stringify(payload.get("orderType"))
                + "&partnerCode=" + stringify(payload.get("partnerCode"))
                + "&payType=" + stringify(payload.get("payType"))
                + "&requestId=" + stringify(payload.get("requestId"))
                + "&responseTime=" + stringify(payload.get("responseTime"))
                + "&resultCode=" + stringify(payload.get("resultCode"))
                + "&transId=" + stringify(payload.get("transId"));
    }

    public static String hmacSha256Hex(String secretKey, String raw) {
        try {
            Mac hmac = Mac.getInstance("HmacSHA256");
            hmac.init(new SecretKeySpec(utf8(secretKey), "HmacSHA256"));
            byte[] digest = hmac.doFinal(utf8(raw));
            StringBuilder hexString = new StringBuilder(2 * digest.length);
            for (byte b : digest) {
                String hex = Integer.toHexString(0xff & b);
                if (hex.length() == 1) {
                    hexString.append('0');
                }
                hexString.append(hex);
            }
            return hexString.toString();
        } catch (Exception e) {
            throw new IllegalStateException("Failed to compute MoMo HMAC-SHA256", e);
        }
    }

    public static boolean signaturesMatch(String expectedHex, String provided) {
        if (expectedHex == null || provided == null) {
            return false;
        }
        return MessageDigest.isEqual(utf8(expectedHex), utf8(provided));
    }

    private static String stringify(Object value) {
        if (value == null) {
            return "";
        }
        if (value instanceof BigDecimal decimal) {
            return decimal.stripTrailingZeros().toPlainString();
        }
        if (value instanceof Double || value instanceof Float) {
            return BigDecimal.valueOf(((Number) value).doubleValue()).stripTrailingZeros().toPlainString();
        }
        if (value instanceof Number number) {
            return Long.toString(number.longValue());
        }
        return String.valueOf(value);
    }

    private static String nullToEmpty(String value) {
        return value == null ? "" : value;
    }

    public static byte[] utf8(String value) {
        return value.getBytes(StandardCharsets.UTF_8);
    }
}
