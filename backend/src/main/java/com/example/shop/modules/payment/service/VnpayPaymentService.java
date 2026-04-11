package com.example.shop.modules.payment.service;

import com.example.shop.modules.payment.dto.VnpayIpnResponse;

import java.util.Map;

public interface VnpayPaymentService {
    VnpayIpnResponse enqueueIpn(Map<String, String> params);

    VnpayIpnResponse processIpn(Map<String, String> params);
}
