package com.example.shop.modules.notification.service;

import com.example.shop.common.mail.EmailService;
import com.example.shop.common.mail.EmailTemplateService;
import com.example.shop.modules.notification.dto.CouponIssuedEmailRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class CouponNotificationService {

    private final EmailService emailService;
    private final EmailTemplateService emailTemplateService;

    public void sendCouponIssuedEmail(CouponIssuedEmailRequest request) {
        String to = safe(request.getTo());
        if (to.isBlank()) {
            throw new IllegalArgumentException("Missing recipient email");
        }

        String redeemUrl = safe(request.getRedeemUrl());
        if (redeemUrl.isBlank()) {
            throw new IllegalArgumentException("Missing coupon redemption URL");
        }

        String customerName = joinNonBlank(request.getCustomerFirstName(), request.getCustomerLastName());
        String subject = safe(request.getNotificationTitle()).isBlank()
                ? "Your coupon is ready"
                : safe(request.getNotificationTitle());
        String content = emailTemplateService.generateCouponIssuedEmail(
                customerName,
                safe(request.getCouponTitle()),
                safe(request.getCouponCode()),
                safe(request.getNotificationTitle()),
                safe(request.getNotificationMessage()),
                redeemUrl,
                safe(request.getExpiresAt())
        );

        emailService.sendEmail(to, subject, content);
    }

    private String joinNonBlank(String first, String last) {
        String firstName = safe(first);
        String lastName = safe(last);
        if (firstName.isBlank()) {
            return lastName;
        }
        if (lastName.isBlank()) {
            return firstName;
        }
        return firstName + " " + lastName;
    }

    private String safe(String value) {
        return value == null ? "" : value.trim();
    }
}
