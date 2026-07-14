package com.example.shop.modules.inventory.repository;

import com.example.shop.modules.inventory.entity.InventoryReservation;
import com.example.shop.modules.inventory.entity.InventoryReservationStatus;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

public interface InventoryReservationRepository extends JpaRepository<InventoryReservation, Long> {

    Optional<InventoryReservation> findByReservationCode(String reservationCode);

    Optional<InventoryReservation> findTopByOrderNumberOrderByIdDesc(String orderNumber);

    List<InventoryReservation> findTop200ByStatusAndExpiresAtBeforeOrderByExpiresAtAsc(
            InventoryReservationStatus status,
            LocalDateTime expiresAt
    );
}
