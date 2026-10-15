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
public class MomoPaymentStatusResponse {
    private String orderNumber;
    private String momoOrderId;
    private String paymentStatus;
    private String orderStatus;
    private boolean paid;
    private String message;
    private long amount;
    private String transId;
}
