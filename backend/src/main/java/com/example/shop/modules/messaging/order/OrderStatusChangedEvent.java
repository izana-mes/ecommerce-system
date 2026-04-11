package com.example.shop.modules.messaging.order;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class OrderStatusChangedEvent {

    private Long orderId;
    private String orderNumber;
    private String customerEmail;
    private String customerName;
    private String oldStatus;
    private String newStatus;
    private String oldPaymentStatus;
    private String newPaymentStatus;

    @Builder.Default
    private LocalDateTime changedAt = LocalDateTime.now();
}
