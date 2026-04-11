package com.example.shop.modules.messaging.inventory;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class LowStockAlertEvent {

    private String productId;
    private String productName;
    private int remainingStock;
    private String orderNumber;

    @Builder.Default
    private LocalDateTime detectedAt = LocalDateTime.now();
}
