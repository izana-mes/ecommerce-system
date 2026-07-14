package com.example.shop.modules.payment.paypal.controller;

import com.example.shop.modules.payment.paypal.dto.PayPalCaptureRequest;
import com.example.shop.modules.payment.paypal.dto.PayPalCaptureResponse;
import com.example.shop.modules.payment.paypal.dto.PayPalCreateOrderResponse;
import com.example.shop.modules.payment.paypal.service.PayPalPaymentService;
import com.example.shop.modules.user.entity.User;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * Thin controller for PayPal Checkout REST API.
 *
 * <p>Controllers contain NO business logic — all logic lives in
 * {@link PayPalPaymentService}.
 *
 * <h2>Endpoints</h2>
 * <pre>
 *   POST /api/payments/paypal/create-order
 *       → Creates a PayPal order server-side. Returns paypalOrderId to frontend.
 *
 *   POST /api/payments/paypal/capture-order
 *       → Captures a PayPal order after user approval.
 *         Validates amount against DB. Updates order status. Emits event.
 * </pre>
 *
 * <h2>Authentication</h2>
 * <p>Both endpoints require a valid JWT. Guest checkout is supported:
 * if no JWT is present the user principal is null and the service
 * performs a looser ownership check (order email only).
 */
@RestController
@RequestMapping("/api/payments/paypal")
@RequiredArgsConstructor
@Slf4j
public class PayPalPaymentController {

    private final PayPalPaymentService payPalPaymentService;

    /**
     * Step 1: Create a PayPal order server-side.
     *
     * <p>The amount is sourced from the DB using {@code orderNumber}.
     * The returned {@code paypalOrderId} is passed to the PayPal JS SDK
     * to show the payment button / pop-up on the frontend.
     *
     * @param orderNumber internal order number (query param)
     * @param user        authenticated user (null for guest)
     */
    @PostMapping("/create-order")
    public ResponseEntity<PayPalCreateOrderResponse> createOrder(
            @RequestParam String orderNumber,
            @AuthenticationPrincipal User user) {

        log.info("[PayPal] Create order request: orderNumber={} user={}",
                orderNumber, user != null ? user.getEmail() : "guest");

        PayPalCreateOrderResponse response = payPalPaymentService.createPayPalOrder(orderNumber, user);
        return ResponseEntity.ok(response);
    }

    /**
     * Step 2: Capture a PayPal order after user approval.
     *
     * <p>Called by the Next.js BFF immediately after the PayPal JS SDK's
     * {@code onApprove} callback fires. The frontend passes the
     * {@code paypalOrderId} and internal {@code orderNumber} — the backend
     * calls PayPal server-to-server to capture and verify.
     *
     * @param request capture payload from frontend
     * @param user    authenticated user (null for guest)
     */
    @PostMapping("/capture-order")
    public ResponseEntity<PayPalCaptureResponse> captureOrder(
            @Valid @RequestBody PayPalCaptureRequest request,
            @AuthenticationPrincipal User user) {

        log.info("[PayPal] Capture order request: paypalOrderId={} orderNumber={} user={}",
                request.getPaypalOrderId(), request.getOrderNumber(),
                user != null ? user.getEmail() : "guest");

        PayPalCaptureResponse response = payPalPaymentService.capturePayPalOrder(request, user);
        return ResponseEntity.ok(response);
    }
}
