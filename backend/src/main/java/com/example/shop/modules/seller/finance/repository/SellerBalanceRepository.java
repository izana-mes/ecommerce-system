package com.example.shop.modules.seller.finance.repository;

import com.example.shop.modules.seller.finance.entity.SellerBalance;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface SellerBalanceRepository extends JpaRepository<SellerBalance, Long> {

    Optional<SellerBalance> findBySellerUserId(UUID sellerUserId);
}

