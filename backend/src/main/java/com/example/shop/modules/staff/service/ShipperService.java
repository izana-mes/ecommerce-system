package com.example.shop.modules.staff.service;

import com.example.shop.modules.staff.dto.ShipperDto;
import com.example.shop.modules.staff.dto.ShipperLocationDto;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface ShipperService {
    List<ShipperDto> listShippers();
    void assignShipper(Long orderId, UUID shipperUserId, String expectedDeliveryAt, String changedBy);
    Optional<ShipperLocationDto> getShipperCurrentLocation(UUID shipperUserId);
}
