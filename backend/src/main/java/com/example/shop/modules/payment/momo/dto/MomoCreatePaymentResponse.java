package com.example.shop.modules.payment.momo.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class MomoCreatePaymentResponse {
    private boolean success;
    private String payUrl;
    private String qrCodeUrl;
    private String deeplink;
    private String orderId;
    private String requestId;
    private String orderNumber;
    private long amount;
    private int resultCode;
    private String message;
}
