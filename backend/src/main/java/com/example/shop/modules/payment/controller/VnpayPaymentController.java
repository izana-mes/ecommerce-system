package com.example.shop.modules.payment.controller;

import com.example.shop.modules.notification.dto.OrderPaidEmailRequest;
import com.example.shop.modules.notification.service.OrderNotificationService;
import com.example.shop.modules.payment.dto.VnpayIpnResponse;
import com.example.shop.modules.payment.service.VnpayPaymentService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/payments/vnpay")
@RequiredArgsConstructor
@Slf4j
public class VnpayPaymentController {

    private final VnpayPaymentService vnpayPaymentService;
    private final OrderNotificationService orderNotificationService;

    /**
     * VNPAY asynchronous IPN callback (GET) — enqueues via RabbitMQ.
     * Only called when RabbitMQ is enabled.
     */
    @GetMapping("/ipn")
    public ResponseEntity<VnpayIpnResponse> handleIpn(@RequestParam Map<String, String> params) {
        return ResponseEntity.ok(vnpayPaymentService.enqueueIpn(params));
    }

    /**
     * Synchronous IPN endpoint called by the Next.js return route after the user
     * is redirected back from VNPAY. Processes payment immediately (no RabbitMQ)
     * and sends the confirmation email directly via SMTP.
     *
     * Body: JSON map of all vnp_* params forwarded from the VNPAY return URL.
     */
    @PostMapping("/ipn")
    public ResponseEntity<VnpayIpnResponse> handleIpnPost(@RequestBody Map<String, String> params) {
        VnpayIpnResponse result = vnpayPaymentService.processIpn(params);

        // Trigger email based on VNPAY's own params (not processIpn rspCode which may return
        // "04" due to USD/VND amount comparison, or "02" on idempotency replay — both of which
        // are fine but the frontend still wants an email sent).
        boolean vnpayConfirmedPaid = "00".equals(params.get("vnp_ResponseCode"))
                && "00".equals(params.get("vnp_TransactionStatus"));

        if (vnpayConfirmedPaid) {
            try {
                OrderPaidEmailRequest emailRequest = vnpayPaymentService.buildOrderPaidEmailRequest(params);
                if (emailRequest != null) {
                    orderNotificationService.sendOrderPaidEmail(emailRequest);
                } else {
                    log.warn("VNPAY IPN: buildOrderPaidEmailRequest returned null for txn {}",
                            params.get("vnp_TxnRef"));
                }
            } catch (Exception ex) {
                log.error("VNPAY IPN: email send failed for txn {}: {}",
                        params.get("vnp_TxnRef"), ex.getMessage(), ex);
            }
        }

        return ResponseEntity.ok(result);
    }

}
