package com.example.shop.config;

import java.time.Instant;

public record WebSocketRevocationEvent(
        String scope,
        String value,
        String reason,
        String requestId,
        String sourceNodeId,
        Instant occurredAt
) {
}
