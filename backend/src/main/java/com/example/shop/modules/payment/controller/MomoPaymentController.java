package com.example.shop.modules.payment.controller;

import com.example.shop.modules.payment.momo.dto.MomoCreatePaymentResponse;
import com.example.shop.modules.payment.momo.dto.MomoPaymentStatusResponse;
import com.example.shop.modules.payment.service.MomoPaymentService;
import com.example.shop.modules.user.entity.User;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.util.StringUtils;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/payments/momo")
@RequiredArgsConstructor
@Slf4j
public class MomoPaymentController {

    private final MomoPaymentService momoPaymentService;

    /**
     * Create a MoMo payment request server-side.
     * Generates cryptographic signature with secretKey and returns the official MoMo payUrl.
     * Supports both query parameter (?orderNumber=...) and JSON body ({"orderNumber": "..."}).
     */
    @PostMapping("/create-payment")
    public ResponseEntity<MomoCreatePaymentResponse> createPayment(
            @RequestParam(required = false) String orderNumber,
            @RequestBody(required = false) Map<String, Object> body,
            @AuthenticationPrincipal User user) {

        String resolvedOrderNumber = orderNumber;
        if (!StringUtils.hasText(resolvedOrderNumber) && body != null) {
            Object obj = body.get("orderNumber");
            if (obj != null) {
                resolvedOrderNumber = String.valueOf(obj);
            }
        }

        if (!StringUtils.hasText(resolvedOrderNumber)) {
            return ResponseEntity.badRequest().body(MomoCreatePaymentResponse.builder()
                    .success(false)
                    .message("Missing orderNumber")
                    .build());
        }

        log.info("[MoMo API] Create payment request for orderNumber={} user={}",
                resolvedOrderNumber, user != null ? user.getEmail() : "guest");

        try {
            MomoCreatePaymentResponse response = momoPaymentService.createPayment(resolvedOrderNumber.trim(), user);
            return ResponseEntity.ok(response);
        } catch (IllegalArgumentException ex) {
            log.warn("[MoMo API] Invalid create payment request: {}", ex.getMessage());
            return ResponseEntity.badRequest().body(MomoCreatePaymentResponse.builder()
                    .success(false)
                    .message(ex.getMessage())
                    .build());
        } catch (IllegalStateException ex) {
            log.error("[MoMo API] Service state error: {}", ex.getMessage());
            return ResponseEntity.internalServerError().body(MomoCreatePaymentResponse.builder()
                    .success(false)
                    .message(ex.getMessage())
                    .build());
        } catch (Exception ex) {
            log.error("[MoMo API] Unexpected error creating MoMo payment: {}", ex.getMessage(), ex);
            return ResponseEntity.internalServerError().body(MomoCreatePaymentResponse.builder()
                    .success(false)
                    .message("Failed to initialize MoMo payment")
                    .build());
        }
    }

    /**
     * Asynchronous server-to-server IPN callback sent by MoMo gateway upon payment completion.
     * Expects HTTP 204 No Content response from merchant backend.
     */
    @PostMapping("/ipn")
    public ResponseEntity<Void> handleIpn(@RequestBody Map<String, Object> payload) {
        log.info("[MoMo API] Received IPN resultCode={} transId={} orderId={} amount={}",
                payload.get("resultCode"), payload.get("transId"),
                payload.get("orderId"), payload.get("amount"));
        try {
            momoPaymentService.processIpn(payload);
        } catch (Exception ex) {
            log.error("[MoMo API] IPN processing error: {}", ex.getMessage(), ex);
            return ResponseEntity.internalServerError().build();
        }
        return ResponseEntity.noContent().build();
    }

    /**
     * Query order payment status directly from database (with server-to-server MoMo verification fallback).
     */
    @GetMapping("/status")
    public ResponseEntity<MomoPaymentStatusResponse> getStatus(@RequestParam String orderNumber) {
        log.info("[MoMo API] Status check requested for orderNumber={}", orderNumber);
        MomoPaymentStatusResponse response = momoPaymentService.getPaymentStatus(orderNumber);
        return ResponseEntity.ok(response);
    }

    /**
     * Actively query transaction state from MoMo gateway server-to-server.
     */
    @PostMapping("/query")
    public ResponseEntity<MomoPaymentStatusResponse> queryTransaction(@RequestParam String orderNumber) {
        log.info("[MoMo API] Gateway query requested for orderNumber={}", orderNumber);
        MomoPaymentStatusResponse response = momoPaymentService.queryMomoTransaction(orderNumber);
        return ResponseEntity.ok(response);
    }

    /**
     * Called by frontend when the user is redirected back from MoMo.
     * Verifies the redirect signature and server-side state.
     */
    @PostMapping("/confirm-redirect")
    public ResponseEntity<Map<String, Object>> confirmRedirect(@RequestBody Map<String, Object> params) {
        log.info("[MoMo API] Confirm-redirect received resultCode={} orderId={} transId={}",
                params.get("resultCode"), params.get("orderId"), params.get("transId"));
        try {
            boolean paid = momoPaymentService.processRedirect(params);
            return ResponseEntity.ok(Map.of(
                    "success", paid,
                    "message", paid ? "Payment confirmed" : "Payment not confirmed"
            ));
        } catch (Exception ex) {
            log.error("[MoMo API] Confirm-redirect error: {}", ex.getMessage(), ex);
            return ResponseEntity.internalServerError().body(Map.of(
                    "success", false,
                    "message", "Error processing payment confirmation"
            ));
        }
    }
}
