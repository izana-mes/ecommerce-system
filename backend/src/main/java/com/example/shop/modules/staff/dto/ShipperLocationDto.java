package com.example.shop.modules.staff.dto;

import java.math.BigDecimal;
import java.time.LocalDateTime;

public record ShipperLocationDto(
        String shipperUserId,
        Long orderId,
        BigDecimal latitude,
        BigDecimal longitude,
        BigDecimal speed,
        BigDecimal heading,
        BigDecimal accuracyMeters,
        LocalDateTime recordedAt
) {}
