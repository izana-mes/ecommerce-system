package com.example.shop.modules.payment.paypal.service;

import com.example.shop.modules.payment.paypal.dto.PayPalCaptureRequest;
import com.example.shop.modules.payment.paypal.dto.PayPalCaptureResponse;
import com.example.shop.modules.payment.paypal.dto.PayPalCreateOrderResponse;
import com.example.shop.modules.user.entity.User;

/**
 * Port for PayPal payment operations.
 *
 * <p>Designed for multi-provider extensibility — a future Stripe or MoMo
 * implementation would implement a similar interface alongside this one.
 */
public interface PayPalPaymentService {

    /**
     * Creates a PayPal order for the given internal order number.
     * The amount is always sourced from the database — never from the caller.
     *
     * @param orderNumber internal order number (must exist and be in "pending" status)
     * @param user        authenticated user (may be null for guest checkout)
     * @return response containing the PayPal order ID to pass to the JS SDK
     */
    PayPalCreateOrderResponse createPayPalOrder(String orderNumber, User user);

    /**
     * Captures a PayPal order after the user has approved it on PayPal's UI.
     *
     * <p>This is the critical idempotent step. It:
     * <ol>
     *   <li>Calls PayPal's capture API server-to-server</li>
     *   <li>Verifies the captured amount matches the DB amount</li>
     *   <li>Updates the order and payment records atomically</li>
     *   <li>Emits an {@code order.paid} event via RabbitMQ</li>
     *   <li>Sends the customer email notification</li>
     * </ol>
     *
     * @param request capture request from frontend (paypalOrderId + orderNumber)
     * @param user    authenticated user for ownership validation
     * @return capture result with paymentStatus and captureId
     */
    PayPalCaptureResponse capturePayPalOrder(PayPalCaptureRequest request, User user);
}
