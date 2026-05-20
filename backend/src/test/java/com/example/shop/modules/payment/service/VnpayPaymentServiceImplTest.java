package com.example.shop.modules.payment.service;

import com.example.shop.modules.coupon.service.CouponService;
import com.example.shop.modules.messaging.notification.OrderPaidEmailMessagePublisher;
import com.example.shop.modules.messaging.order.OrderStatusChangedPublisher;
import com.example.shop.modules.messaging.payment.PaymentIpnMessagePublisher;
import com.example.shop.modules.payment.dto.VnpayIpnResponse;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.jdbc.core.JdbcTemplate;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;

@ExtendWith(MockitoExtension.class)
class VnpayPaymentServiceImplTest {

    @Mock private JdbcTemplate jdbcTemplate;
    @Mock private ObjectMapper objectMapper;
    @Mock private PaymentIpnMessagePublisher paymentIpnMessagePublisher;
    @Mock private OrderPaidEmailMessagePublisher orderPaidEmailMessagePublisher;
    @Mock private OrderStatusChangedPublisher orderStatusChangedPublisher;
    @Mock private CouponService couponService;

    @InjectMocks private VnpayPaymentServiceImpl service;

    @Test
    void enqueueIpn_acceptsValidPayload() {
        Map<String, String> payload = Map.of("vnp_TxnRef", "ORD-1", "vnp_SecureHash", "abc");

        VnpayIpnResponse response = service.enqueueIpn(payload);

        assertEquals("00", response.getRspCode());
        verify(paymentIpnMessagePublisher).publish(any());
    }

    @Test
    void enqueueIpn_rejectsMissingFields() {
        VnpayIpnResponse response = service.enqueueIpn(Map.of());
        assertEquals("99", response.getRspCode());
    }
}
