package com.example.shop.modules.inventory.messaging;

import lombok.*;

import java.time.LocalDateTime;

@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class InventoryReservationEvent {
    private String eventType;
    private String reservationCode;
    private String orderNumber;
    private String status;
    private LocalDateTime occurredAt;
}
