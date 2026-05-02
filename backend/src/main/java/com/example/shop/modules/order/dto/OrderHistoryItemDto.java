package com.example.shop.modules.order.dto;

import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@Builder
public class OrderHistoryItemDto {
    private Long id;
    private String orderNumber;
    private String trackingSecret;
    /** Populated for staff-scoped listings and admin lookups; optional for legacy customer-only rows */
    private String customerEmail;
    private String customerFirstName;
    private String customerLastName;
    private BigDecimal totalAmount;
    private String currency;
    private String paymentMethod;
    private String paymentStatus;
    private String orderStatus;
    private int itemCount;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    private String shippingCarrier;
    private String shippingTrackingPublic;
    private LocalDateTime shippedAt;
}
