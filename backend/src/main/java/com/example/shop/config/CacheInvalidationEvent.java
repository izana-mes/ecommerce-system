package com.example.shop.config;

import java.time.Instant;
import java.util.List;

public record CacheInvalidationEvent(
        String sourceNodeId,
        List<String> cacheNames,
        Instant occurredAt
) {
}
