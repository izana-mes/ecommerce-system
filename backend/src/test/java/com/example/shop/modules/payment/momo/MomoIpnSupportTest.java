package com.example.shop.modules.payment.momo;

import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.LinkedHashMap;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class MomoIpnSupportTest {

    @Test
    void convertsUsdToIntegerVnd() {
        assertEquals(1_170_000L, MomoIpnSupport.toVndAmount(new BigDecimal("45.00"), 26_000));
    }

    @Test
    void resolvesShopOrderNumberFromExtraDataOnly() {
        String extra = Base64.getEncoder().encodeToString(
                "{\"orderNumber\":\"ORD-8770951354-0340\"}".getBytes(StandardCharsets.UTF_8));
        assertEquals("ORD-8770951354-0340", MomoIpnSupport.resolveOrderNumber("unrelated.abc", extra));
        assertEquals("ORD-1.unique", MomoIpnSupport.resolveOrderNumber("ORD-1.unique", ""));
    }

    @Test
    void ipnSignatureUsesDocumentedFieldOrderAndHmac() {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("amount", 1170000);
        payload.put("extraData", "");
        payload.put("message", "Successful.");
        payload.put("orderId", "ORD-1-1");
        payload.put("orderInfo", "pay");
        payload.put("orderType", "momo_wallet");
        payload.put("partnerCode", "MOMO");
        payload.put("payType", "qr");
        payload.put("requestId", "req");
        payload.put("responseTime", 1L);
        payload.put("resultCode", 0);
        payload.put("transId", 99L);

        String raw = MomoIpnSupport.buildIpnRawSignature("access", payload);
        assertEquals(
                "accessKey=access&amount=1170000&extraData=&message=Successful.&orderId=ORD-1-1&orderInfo=pay&orderType=momo_wallet&partnerCode=MOMO&payType=qr&requestId=req&responseTime=1&resultCode=0&transId=99",
                raw);

        String hex = MomoIpnSupport.hmacSha256Hex("secret", raw);
        assertEquals(64, hex.length());
        assertTrue(MomoIpnSupport.signaturesMatch(hex, hex));
        assertFalse(MomoIpnSupport.signaturesMatch(hex, "00" + hex.substring(2)));
    }
}
