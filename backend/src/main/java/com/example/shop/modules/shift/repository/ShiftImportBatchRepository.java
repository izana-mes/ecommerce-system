package com.example.shop.modules.shift.repository;

import com.example.shop.modules.shift.entity.ShiftImportBatch;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.UUID;

public interface ShiftImportBatchRepository extends JpaRepository<ShiftImportBatch, UUID> {
}
