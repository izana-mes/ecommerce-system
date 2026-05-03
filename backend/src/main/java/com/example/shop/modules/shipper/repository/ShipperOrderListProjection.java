package com.example.shop.modules.shipper.repository;

import java.time.LocalDateTime;
import java.util.UUID;

public interface ShipperOrderListProjection {
    Long getOrderId();

    String getOrderNumber();

    String getOrderStatus();

    UUID getShipperUserId();

    LocalDateTime getExpectedDeliveryAt();

    LocalDateTime getPickedUpAt();

    LocalDateTime getDeliveredAt();

    LocalDateTime getFailedAt();
}

