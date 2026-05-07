package com.example.shop.modules.seller.finance.service;

import com.example.shop.modules.seller.finance.dto.SellerBalanceDto;
import com.example.shop.modules.seller.finance.dto.TransactionPageDto;

import java.math.BigDecimal;
import java.util.UUID;

public interface SellerFinanceService {

    SellerBalanceDto getBalance(UUID sellerUserId);

    /**
     * Paginated transaction history, all types.
     */
    TransactionPageDto getTransactions(UUID sellerUserId, int page, int size);

    /**
     * Paginated transaction history filtered by type string (case-insensitive).
     * Pass {@code null} or blank to return all types.
     */
    TransactionPageDto getTransactions(UUID sellerUserId, int page, int size, String type);

    /**
     * Record income from an order line item. Calculates commission and credits net amount.
     */
    void recordOrderIncome(UUID sellerUserId, String orderNumber, String productId, BigDecimal grossAmount);

    /**
     * Record a refund (order cancellation). Deducts from available balance.
     */
    void recordRefund(UUID sellerUserId, String orderNumber, BigDecimal amount);
}
