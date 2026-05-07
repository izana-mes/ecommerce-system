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
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

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
        return getTransactions(sellerUserId, page, size, null);
    }

    /**
     * {@inheritDoc}
     *
     * <p>When {@code type} is provided, delegates to the type-filtered repository
     * method to avoid fetching all rows and filtering in memory.
     */
    @Override
    @Transactional(readOnly = true)
    public TransactionPageDto getTransactions(UUID sellerUserId, int page, int size, String type) {
        int safePage = Math.max(0, page);
        int safeSize = Math.max(1, Math.min(size, 100));
        PageRequest pageable = PageRequest.of(safePage, safeSize);

        Page<SellerTransaction> resultPage;

        if (StringUtils.hasText(type)) {
            SellerTransaction.TransactionType txType;
            try {
                txType = SellerTransaction.TransactionType.valueOf(type.trim().toUpperCase());
            } catch (IllegalArgumentException ex) {
                // Unknown type — return empty page rather than 500
                return TransactionPageDto.builder()
                        .content(List.of())
                        .page(safePage)
                        .size(safeSize)
                        .totalElements(0)
                        .totalPages(0)
                        .build();
            }
            resultPage = transactionRepository
                    .findBySellerUserIdAndTypeOrderByCreatedAtDesc(sellerUserId, txType, pageable);
        } else {
            resultPage = transactionRepository
                    .findBySellerUserIdOrderByCreatedAtDesc(sellerUserId, pageable);
        }

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
        BigDecimal deduct = safeAmount.min(balance.getAvailableBalance());
        balance.setAvailableBalance(
                balance.getAvailableBalance().subtract(deduct).setScale(2, RoundingMode.HALF_UP));
        balanceRepository.save(balance);

        log.info("Recorded refund for seller {} order {}: amount={}", sellerUserId, orderNumber, safeAmount);
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    /**
     * Gets or creates the seller balance row, handling the race condition where two
     * concurrent requests for a brand-new seller both try to INSERT and hit the
     * UNIQUE constraint on {@code seller_user_id}.
     *
     * <p>Strategy: attempt a normal find-or-save, and if a
     * {@link DataIntegrityViolationException} is thrown (duplicate key), re-fetch
     * the row that the concurrent thread already committed.
     */
    @Transactional
    protected SellerBalance getOrCreateBalance(UUID sellerUserId) {
        return balanceRepository.findBySellerUserId(sellerUserId).orElseGet(() -> {
            try {
                SellerBalance fresh = SellerBalance.builder()
                        .sellerUserId(sellerUserId)
                        .availableBalance(BigDecimal.ZERO)
                        .pendingBalance(BigDecimal.ZERO)
                        .totalEarned(BigDecimal.ZERO)
                        .currency("USD")
                        .build();
                return balanceRepository.saveAndFlush(fresh);
            } catch (DataIntegrityViolationException ex) {
                // Another concurrent request already inserted — re-fetch the committed row.
                log.debug("Race condition on seller_balance insert for seller {}; re-fetching.", sellerUserId);
                return balanceRepository.findBySellerUserId(sellerUserId)
                        .orElseThrow(() -> new IllegalStateException(
                                "Could not create or load balance for seller " + sellerUserId, ex));
            }
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
