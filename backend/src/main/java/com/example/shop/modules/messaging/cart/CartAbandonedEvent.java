package com.example.shop.modules.messaging.cart;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CartAbandonedEvent {

    private UUID userId;
    private String email;
    private String firstName;
    private Integer itemCount;
    private Integer totalQuantity;
    private LocalDateTime lastActivityAt;
    private LocalDateTime queuedAt;
}
