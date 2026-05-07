package com.example.shop.modules.seller.finance.repository;

import com.example.shop.modules.seller.finance.entity.SellerTransaction;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.UUID;

public interface SellerTransactionRepository extends JpaRepository<SellerTransaction, Long> {

    /** All transactions for a seller, newest first — used by the paginated history endpoint. */
    Page<SellerTransaction> findBySellerUserIdOrderByCreatedAtDesc(UUID sellerUserId, Pageable pageable);

    /** Transactions for a seller filtered by type, newest first — e.g. show only ORDER_INCOME or REFUND. */
    Page<SellerTransaction> findBySellerUserIdAndTypeOrderByCreatedAtDesc(
            UUID sellerUserId,
            SellerTransaction.TransactionType type,
            Pageable pageable
    );
}
