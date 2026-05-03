package com.example.shop.modules.staff.dto;

import java.math.BigDecimal;
import java.time.LocalDateTime;

public record SlaOrderDto(
        Long id,
        String orderNumber,
        String customerEmail,
        String customerFirstName,
        String customerLastName,
        String orderStatus,
        String paymentStatus,
        String shipperUserId,
        String shipperEmail,
        BigDecimal totalAmount,
        String currency,
        LocalDateTime expectedDeliveryAt,
        LocalDateTime createdAt,
        /** Positive = minutes already late. Negative = minutes remaining before late. */
        long minutesLate,
        /** ON_TIME | NEAR_LATE | LATE */
        String slaStatus
) {}
