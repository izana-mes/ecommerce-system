package com.example.shop.modules.seller.finance.repository;

import com.example.shop.modules.seller.finance.entity.SellerTransaction;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.UUID;

public interface SellerTransactionRepository extends JpaRepository<SellerTransaction, Long> {

    Page<SellerTransaction> findBySellerUserIdOrderByCreatedAtDesc(UUID sellerUserId, Pageable pageable);
}

