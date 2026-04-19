package com.example.shop.modules.payment.service;

import java.util.Map;

public interface MomoPaymentService {
    void processIpn(Map<String, Object> payload);
}
