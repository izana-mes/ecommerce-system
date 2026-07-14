package com.example.shop.modules.inventory.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import lombok.Data;

import java.time.LocalDateTime;
import java.util.List;

public final class InventoryReservationDtos {

    private InventoryReservationDtos() {
    }

    @Data
    public static class ReserveRequest {
        @NotBlank
        private String orderNumber;

        @Min(1)
        private Integer ttlMinutes = 15;

        @Valid
        @NotEmpty
        private List<Item> items;
    }

    @Data
    public static class Item {
        @NotBlank
        private String productId;

        @Min(1)
        private Integer quantity;
    }

    @Data
    public static class ReservationResponse {
        private String reservationCode;
        private String orderNumber;
        private String status;
        private LocalDateTime expiresAt;
    }
}
