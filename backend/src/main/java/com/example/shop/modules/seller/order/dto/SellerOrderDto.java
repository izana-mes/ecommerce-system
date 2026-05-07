package com.example.shop.modules.seller.order.dto;

import lombok.Builder;
import lombok.Getter;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Getter
@Builder
public class SellerOrderDto {
    private String orderNumber;
    private String productId;
    private String productName;
    private int quantity;
    private BigDecimal lineTotal;
    private String orderStatus;
    private String paymentStatus;
    private LocalDateTime createdAt;
    /** Customer display name (first + last name stored on the order). */
    private String customerName;
    /** Shipping address as stored on the order at time of placement. */
    private String shippingAddress;
}
