package com.example.shop.modules.shift.repository;

import com.example.shop.modules.shift.entity.ShiftSwapRequest;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface ShiftSwapRequestRepository extends JpaRepository<ShiftSwapRequest, UUID> {
    List<ShiftSwapRequest> findByRequesterIdOrderByCreatedAtDesc(UUID requesterId);
}
