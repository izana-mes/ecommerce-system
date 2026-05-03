package com.example.shop.modules.staff.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class AssignShipperRequest {
    @NotBlank(message = "shipperUserId is required")
    private String shipperUserId;

    /** Optional ISO-8601 date-time string for expected delivery (e.g. 2026-05-04T15:00:00) */
    private String expectedDeliveryAt;
}
