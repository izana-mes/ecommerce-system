package com.example.shop.modules.shipper.repository;

import com.example.shop.modules.shipper.entity.ShipperIssueLog;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ShipperIssueLogRepository extends JpaRepository<ShipperIssueLog, Long> {
    List<ShipperIssueLog> findByOrderIdOrderByCreatedAtDesc(Long orderId);
}
