package com.example.shop.modules.payment.controller;

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
     * and lets payment service publish buyer email only when payment is successful.
     *
     * Body: JSON map of all vnp_* params forwarded from the VNPAY return URL.
     */
    @PostMapping("/ipn")
    public ResponseEntity<VnpayIpnResponse> handleIpnPost(@RequestBody Map<String, String> params) {
        return ResponseEntity.ok(vnpayPaymentService.processIpn(params));
    }

}
