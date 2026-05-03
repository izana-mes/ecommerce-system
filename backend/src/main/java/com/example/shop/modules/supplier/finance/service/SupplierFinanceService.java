package com.example.shop.modules.supplier.finance.service;

import com.example.shop.modules.supplier.finance.dto.SupplierBalanceDto;
import com.example.shop.modules.supplier.finance.dto.TransactionPageDto;

import java.math.BigDecimal;
import java.util.UUID;

public interface SupplierFinanceService {

    SupplierBalanceDto getBalance(UUID supplierUserId);

    TransactionPageDto getTransactions(UUID supplierUserId, int page, int size);

    /**
     * Record income from an order line item. Calculates commission and credits net amount.
     */
    void recordOrderIncome(UUID supplierUserId, String orderNumber, String productId, BigDecimal grossAmount);

    /**
     * Record a refund (order cancellation). Deducts from available balance.
     */
    void recordRefund(UUID supplierUserId, String orderNumber, BigDecimal amount);
}
