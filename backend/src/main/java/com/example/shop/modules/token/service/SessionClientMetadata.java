package com.example.shop.modules.token.service;

public record SessionClientMetadata(
        String ipAddress,
        String userAgent,
        String deviceId,
        String requestId
) {
}
