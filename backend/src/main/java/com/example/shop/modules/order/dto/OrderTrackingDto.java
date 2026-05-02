package com.example.shop.modules.order.dto;

import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Data
@Builder
public class OrderTrackingDto {
    private String orderNumber;
    private String orderStatus;
    private String paymentStatus;
    private LocalDateTime createdAt;
    private String shippingCity;
    private String shippingCountry;
    private BigDecimal deliveryLatitude;
    private BigDecimal deliveryLongitude;
    private String deliveryLocationLabel;
    private BigDecimal deliveryLocationAccuracyMeters;

    private String shippingCarrier;
    private String shippingTrackingPublic;
    private LocalDateTime shippedAt;

    @Builder.Default
    private List<OrderTrackingLineDto> items = new ArrayList<>();
}
