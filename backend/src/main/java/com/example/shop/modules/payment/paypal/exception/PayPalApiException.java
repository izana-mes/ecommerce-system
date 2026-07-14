package com.example.shop.modules.payment.paypal.exception;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.ResponseStatus;

/**
 * Thrown when a PayPal API call fails (HTTP or SDK error).
 */
@ResponseStatus(HttpStatus.BAD_GATEWAY)
public class PayPalApiException extends RuntimeException {
    public PayPalApiException(String message) {
        super(message);
    }

    public PayPalApiException(String message, Throwable cause) {
        super(message, cause);
    }
}
