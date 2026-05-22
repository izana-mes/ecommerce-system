package com.example.shop.modules.payment.paypal.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * Request body sent by frontend to capture a PayPal order after user approval.
 *
 * <p>Security note: the backend always re-validates the order amount from the DB.
 * We never trust an amount passed from the frontend.
 */
@Getter
@Setter
@NoArgsConstructor
public class PayPalCaptureRequest {

    /** PayPal Order ID returned from the JS SDK onApprove callback. */
    @NotBlank(message = "paypalOrderId is required")
    private String paypalOrderId;

    /** Internal order number used to look up the DB record and validate amount. */
    @NotBlank(message = "orderNumber is required")
    private String orderNumber;
}
