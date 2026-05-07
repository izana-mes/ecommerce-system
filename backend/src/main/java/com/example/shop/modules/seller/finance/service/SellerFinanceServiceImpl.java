package com.example.shop.modules.seller.finance.service;

import com.example.shop.modules.seller.finance.dto.SellerBalanceDto;
import com.example.shop.modules.seller.finance.dto.SellerTransactionDto;
import com.example.shop.modules.seller.finance.dto.TransactionPageDto;
import com.example.shop.modules.seller.finance.entity.SellerBalance;
import com.example.shop.modules.seller.finance.entity.SellerTransaction;
import com.example.shop.modules.seller.finance.repository.SellerBalanceRepository;
import com.example.shop.modules.seller.finance.repository.SellerTransactionRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.List;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class SellerFinanceServiceImpl implements SellerFinanceService {

    private final SellerBalanceRepository balanceRepository;
    private final SellerTransactionRepository transactionRepository;

    @Value("${application.seller.commission-rate:0.10}")
    private BigDecimal commissionRate;

    // ── Public API ────────────────────────────────────────────────────────────

    @Override
    @Transactional
    public SellerBalanceDto getBalance(UUID sellerUserId) {
        SellerBalance balance = getOrCreateBalance(sellerUserId);
        return toBalanceDto(balance);
    }

    @Override
    @Transactional(readOnly = true)
    public TransactionPageDto getTransactions(UUID sellerUserId, int page, int size) {
        int safePage = Math.max(0, page);
        int safeSize = Math.max(1, Math.min(size, 100));

        Page<SellerTransaction> resultPage = transactionRepository
                .findBySellerUserIdOrderByCreatedAtDesc(sellerUserId, PageRequest.of(safePage, safeSize));

        List<SellerTransactionDto> content = resultPage.getContent().stream()
                .map(this::toTransactionDto)
                .toList();

        return TransactionPageDto.builder()
                .content(content)
                .page(safePage)
                .size(safeSize)
                .totalElements(resultPage.getTotalElements())
                .totalPages(resultPage.getTotalPages())
                .build();
    }

    @Override
    @Transactional
    public void recordOrderIncome(UUID sellerUserId, String orderNumber, String productId, BigDecimal grossAmount) {
        if (grossAmount == null || grossAmount.compareTo(BigDecimal.ZERO) <= 0) {
            log.warn("recordOrderIncome: non-positive grossAmount {} for seller {}", grossAmount, sellerUserId);
            return;
        }

        BigDecimal commission = grossAmount
                .multiply(commissionRate)
                .setScale(2, RoundingMode.HALF_UP);
        BigDecimal net = grossAmount.subtract(commission).setScale(2, RoundingMode.HALF_UP);

        // Persist transaction
        SellerTransaction tx = SellerTransaction.builder()
                .sellerUserId(sellerUserId)
                .orderNumber(orderNumber)
                .productId(productId)
                .type(SellerTransaction.TransactionType.ORDER_INCOME)
                .grossAmount(grossAmount.setScale(2, RoundingMode.HALF_UP))
                .commissionAmount(commission)
                .netAmount(net)
                .description("Order income: " + orderNumber)
                .build();
        transactionRepository.save(tx);

        // Credit commission transaction (separate row for transparency)
        SellerTransaction commissionTx = SellerTransaction.builder()
                .sellerUserId(sellerUserId)
                .orderNumber(orderNumber)
                .productId(productId)
                .type(SellerTransaction.TransactionType.COMMISSION)
                .grossAmount(commission)
                .commissionAmount(BigDecimal.ZERO)
                .netAmount(commission.negate())
                .description("Platform commission (" +
                        commissionRate.multiply(BigDecimal.valueOf(100)).stripTrailingZeros().toPlainString()
                        + "%): " + orderNumber)
                .build();
        transactionRepository.save(commissionTx);

        // Update balance
        SellerBalance balance = getOrCreateBalance(sellerUserId);
        balance.setAvailableBalance(
                balance.getAvailableBalance().add(net).setScale(2, RoundingMode.HALF_UP));
        balance.setTotalEarned(
                balance.getTotalEarned().add(net).setScale(2, RoundingMode.HALF_UP));
        balanceRepository.save(balance);

        log.info("Recorded order income for seller {} order {}: gross={} commission={} net={}",
                sellerUserId, orderNumber, grossAmount, commission, net);
    }

    @Override
    @Transactional
    public void recordRefund(UUID sellerUserId, String orderNumber, BigDecimal amount) {
        if (amount == null || amount.compareTo(BigDecimal.ZERO) <= 0) {
            log.warn("recordRefund: non-positive amount {} for seller {}", amount, sellerUserId);
            return;
        }

        BigDecimal safeAmount = amount.setScale(2, RoundingMode.HALF_UP);

        SellerTransaction tx = SellerTransaction.builder()
                .sellerUserId(sellerUserId)
                .orderNumber(orderNumber)
                .type(SellerTransaction.TransactionType.REFUND)
                .grossAmount(safeAmount.negate())
                .commissionAmount(BigDecimal.ZERO)
                .netAmount(safeAmount.negate())
                .description("Refund / cancellation: " + orderNumber)
                .build();
        transactionRepository.save(tx);

        SellerBalance balance = getOrCreateBalance(sellerUserId);
        BigDecimal deduct = safeAmount.min(balance.getAvailableBalance()); // don't go negative
        balance.setAvailableBalance(
                balance.getAvailableBalance().subtract(deduct).setScale(2, RoundingMode.HALF_UP));
        balanceRepository.save(balance);

        log.info("Recorded refund for seller {} order {}: amount={}", sellerUserId, orderNumber, safeAmount);
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    /**
     * Fetches the existing balance row or creates a fresh zero-balance if it doesn't exist yet.
     * Called inside @Transactional methods so the new row is committed atomically.
     */
    private SellerBalance getOrCreateBalance(UUID sellerUserId) {
        return balanceRepository.findBySellerUserId(sellerUserId).orElseGet(() -> {
            SellerBalance fresh = SellerBalance.builder()
                    .sellerUserId(sellerUserId)
                    .availableBalance(BigDecimal.ZERO)
                    .pendingBalance(BigDecimal.ZERO)
                    .totalEarned(BigDecimal.ZERO)
                    .currency("USD")
                    .build();
            return balanceRepository.save(fresh);
        });
    }

    private SellerBalanceDto toBalanceDto(SellerBalance balance) {
        return SellerBalanceDto.builder()
                .availableBalance(orZero(balance.getAvailableBalance()))
                .pendingBalance(orZero(balance.getPendingBalance()))
                .totalEarned(orZero(balance.getTotalEarned()))
                .currency(balance.getCurrency())
                .build();
    }

    private SellerTransactionDto toTransactionDto(SellerTransaction tx) {
        return SellerTransactionDto.builder()
                .id(tx.getId())
                .orderNumber(tx.getOrderNumber())
                .productId(tx.getProductId())
                .type(tx.getType().name())
                .grossAmount(orZero(tx.getGrossAmount()))
                .commissionAmount(orZero(tx.getCommissionAmount()))
                .netAmount(orZero(tx.getNetAmount()))
                .description(tx.getDescription())
                .createdAt(tx.getCreatedAt())
                .build();
    }

    private BigDecimal orZero(BigDecimal value) {
        return value == null ? BigDecimal.ZERO : value;
    }
}

