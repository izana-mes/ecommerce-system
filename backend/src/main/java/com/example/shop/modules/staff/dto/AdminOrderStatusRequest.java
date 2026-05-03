package com.example.shop.modules.staff.dto;

import lombok.Data;

@Data
public class AdminOrderStatusRequest {
    private String orderStatus;
    private String paymentStatus;
    private String reason;
}
