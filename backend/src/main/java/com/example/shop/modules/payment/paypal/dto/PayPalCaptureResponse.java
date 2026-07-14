package com.example.shop.modules.payment.paypal.dto;

import lombok.Builder;
import lombok.Getter;

/**
 * Response returned to the frontend after a capture attempt.
 */
@Getter
@Builder
public class PayPalCaptureResponse {
    /** Whether the payment was captured and confirmed. */
    private boolean success;
    /** Human-readable result message. */
    private String message;
    /** Internal order number. */
    private String orderNumber;
    /** PayPal capture ID — stored in DB for reconciliation. */
    private String captureId;
    /** Payment status as stored in DB: "paid", "failed", "cancelled". */
    private String paymentStatus;
}
