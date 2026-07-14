package com.example.shop.modules.shift.repository;

import com.example.shop.modules.shift.entity.ShiftLeaveRequest;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface ShiftLeaveRequestRepository extends JpaRepository<ShiftLeaveRequest, UUID> {
    List<ShiftLeaveRequest> findByRequesterIdOrderByCreatedAtDesc(UUID requesterId);
}
