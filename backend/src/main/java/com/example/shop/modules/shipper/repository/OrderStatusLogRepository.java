package com.example.shop.modules.shipper.repository;

import com.example.shop.modules.shipper.entity.OrderStatusLog;
import org.springframework.data.jpa.repository.JpaRepository;

public interface OrderStatusLogRepository extends JpaRepository<OrderStatusLog, Long> {
}
