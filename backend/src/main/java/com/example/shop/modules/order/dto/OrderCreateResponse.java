package com.example.shop.modules.order.dto;

import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;

@Data
@Builder
public class OrderCreateResponse {
    private Long orderId;
    private String orderNumber;
    /** Opaque token for guest-safe order tracking (do not share publicly except with the customer). */
    private String trackingSecret;
    private BigDecimal subtotal;
    private BigDecimal shippingFee;
    private BigDecimal vat;
    private BigDecimal discountAmount;
    private BigDecimal totalAmount;
    private String currency;
    private String couponCode;
    private Integer pointsRedeemed;
    private BigDecimal pointsDiscountAmount;
    private Integer pointsEarned;
    private Long remainingPoints;
    private String paymentStatus;
    private String orderStatus;
}
