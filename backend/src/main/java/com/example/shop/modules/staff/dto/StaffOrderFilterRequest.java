package com.example.shop.modules.staff.dto;

import lombok.Data;

import java.time.LocalDate;

@Data
public class StaffOrderFilterRequest {
    private String status;
    private String paymentStatus;
    private LocalDate dateFrom;
    private LocalDate dateTo;
    /** Filter orders assigned to this shipper (UUID string) */
    private String shipperUserId;
    /** Filter orders containing a product from this supplier product id */
    private String supplierProductId;
    private int page = 0;
    private int size = 20;
}
