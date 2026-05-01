package com.example.shop.modules.messaging.order;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class OrderCreatedEvent {

    private Long orderId;
    private String orderNumber;
    private String trackingSecret;
    private String customerEmail;
    private String customerFirstName;
    private String customerLastName;
    private String customerPhone;
    private String shippingAddressLine1;
    private String shippingAddressLine2;
    private String shippingCity;
    private String shippingState;
    private String shippingPostalCode;
    private String shippingCountry;
    private String notes;
    private BigDecimal subtotal;
    private BigDecimal shippingFee;
    private BigDecimal vat;
    private BigDecimal discountAmount;
    private BigDecimal totalAmount;
    private String currency;
    private String paymentMethod;

    @Builder.Default
    private List<OrderItemSnapshot> items = new ArrayList<>();

    @Builder.Default
    private LocalDateTime createdAt = LocalDateTime.now();

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class OrderItemSnapshot {
        private String productId;
        private String productName;
        private BigDecimal unitPrice;
        private int quantity;
        private BigDecimal lineTotal;
    }
}
