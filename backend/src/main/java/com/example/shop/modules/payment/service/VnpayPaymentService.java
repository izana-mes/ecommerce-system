package com.example.shop.modules.payment.service;

import com.example.shop.modules.notification.dto.OrderPaidEmailRequest;
import com.example.shop.modules.payment.dto.VnpayIpnResponse;

import java.util.Map;

public interface VnpayPaymentService {
    VnpayIpnResponse enqueueIpn(Map<String, String> params);

    VnpayIpnResponse processIpn(Map<String, String> params);

    /**
     * Builds an {@link OrderPaidEmailRequest} from VNPAY IPN params after
     * {@link #processIpn} has succeeded. Returns null if the order cannot be found.
     */
    OrderPaidEmailRequest buildOrderPaidEmailRequest(Map<String, String> params);
}

