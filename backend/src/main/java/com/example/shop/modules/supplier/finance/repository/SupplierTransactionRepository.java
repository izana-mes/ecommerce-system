package com.example.shop.modules.supplier.finance.repository;

import com.example.shop.modules.supplier.finance.entity.SupplierTransaction;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.UUID;

public interface SupplierTransactionRepository extends JpaRepository<SupplierTransaction, Long> {

    Page<SupplierTransaction> findBySupplierUserIdOrderByCreatedAtDesc(UUID supplierUserId, Pageable pageable);
}
