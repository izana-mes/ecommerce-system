package com.example.shop.modules.shipper.repository;

import com.example.shop.modules.shipper.entity.ShipperLocationHistory;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface ShipperLocationHistoryRepository extends JpaRepository<ShipperLocationHistory, Long> {
    Optional<ShipperLocationHistory> findTopByShipperUserIdOrderByRecordedAtDesc(UUID shipperUserId);
}
