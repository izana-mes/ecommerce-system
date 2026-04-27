package com.example.shop.modules.notification.dto;

import lombok.Data;

@Data
public class CouponIssuedEmailRequest {
    private String to;
    private String customerFirstName;
    private String customerLastName;
    private String couponCode;
    private String couponTitle;
    private String notificationTitle;
    private String notificationMessage;
    private String redeemUrl;
    private String expiresAt;
}
