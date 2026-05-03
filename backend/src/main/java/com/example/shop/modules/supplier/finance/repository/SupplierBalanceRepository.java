package com.example.shop.modules.supplier.finance.repository;

import com.example.shop.modules.supplier.finance.entity.SupplierBalance;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface SupplierBalanceRepository extends JpaRepository<SupplierBalance, Long> {

    Optional<SupplierBalance> findBySupplierUserId(UUID supplierUserId);
}
