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
    private BigDecimal totalAmount;
    private String currency;
    private String paymentMethod;
    private String paymentStatus;
    private String orderStatus;
    private int itemCount;
    private LocalDateTime createdAt;
}
