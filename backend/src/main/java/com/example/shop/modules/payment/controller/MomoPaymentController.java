package com.example.shop.modules.payment.controller;

import com.example.shop.modules.payment.service.MomoPaymentService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/payments/momo")
@RequiredArgsConstructor
@Slf4j
public class MomoPaymentController {

    private final MomoPaymentService momoPaymentService;

    @PostMapping("/ipn")
    public ResponseEntity<Void> handleIpn(@RequestBody Map<String, Object> payload) {
        log.info("Received MoMo IPN: {}", payload);
        try {
            momoPaymentService.processIpn(payload);
        } catch (Exception ex) {
            log.error("MoMo IPN processing error: {}", ex.getMessage(), ex);
        }
        // MoMo expects 204 No Content for successful receipt of IPN to stop retries.
        return ResponseEntity.noContent().build();
    }
}
