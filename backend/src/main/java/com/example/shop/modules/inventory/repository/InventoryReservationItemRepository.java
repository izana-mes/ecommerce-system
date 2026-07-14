package com.example.shop.modules.inventory.repository;

import com.example.shop.modules.inventory.entity.InventoryReservation;
import com.example.shop.modules.inventory.entity.InventoryReservationItem;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface InventoryReservationItemRepository extends JpaRepository<InventoryReservationItem, Long> {

    List<InventoryReservationItem> findByReservation(InventoryReservation reservation);
}
