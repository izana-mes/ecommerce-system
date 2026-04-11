package com.example.shop.modules.messaging.payment;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class VnpayIpnMessage {

    @Builder.Default
    private Map<String, String> params = new HashMap<>();

    @Builder.Default
    private LocalDateTime receivedAt = LocalDateTime.now();
}
