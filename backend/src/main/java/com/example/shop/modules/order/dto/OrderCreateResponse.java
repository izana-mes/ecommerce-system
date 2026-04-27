package com.example.shop.modules.order.dto;

import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;

@Data
@Builder
public class OrderCreateResponse {
    private Long orderId;
    private String orderNumber;
    private BigDecimal subtotal;
    private BigDecimal shippingFee;
    private BigDecimal vat;
    private BigDecimal discountAmount;
    private BigDecimal totalAmount;
    private String currency;
    private String couponCode;
    private String paymentStatus;
    private String orderStatus;
}
