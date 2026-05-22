package com.example.shop.modules.payment.paypal.dto;

import lombok.Builder;
import lombok.Getter;

/**
 * Response returned to frontend after backend creates a PayPal order.
 * Contains only the PayPal order ID — the secret is kept server-side.
 */
@Getter
@Builder
public class PayPalCreateOrderResponse {
    /** PayPal Order ID (e.g. "7B926234UK637891M"). Passed to PayPal JS SDK on frontend. */
    private String paypalOrderId;
    /** Internal order number for correlation. */
    private String orderNumber;
}
