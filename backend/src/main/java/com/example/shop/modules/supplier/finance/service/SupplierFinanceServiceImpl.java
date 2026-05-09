package com.example.shop.modules.supplier.finance.service;

import com.example.shop.modules.supplier.finance.dto.SupplierBalanceDto;
import com.example.shop.modules.supplier.finance.dto.SupplierTransactionDto;
import com.example.shop.modules.supplier.finance.dto.TransactionPageDto;
import com.example.shop.modules.supplier.finance.entity.SupplierBalance;
import com.example.shop.modules.supplier.finance.entity.SupplierTransaction;
import com.example.shop.modules.supplier.finance.repository.SupplierBalanceRepository;
import com.example.shop.modules.supplier.finance.repository.SupplierTransactionRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.dao.DataIntegrityViolationException;
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
public class SupplierFinanceServiceImpl implements SupplierFinanceService {

    private final SupplierBalanceRepository balanceRepository;
    private final SupplierTransactionRepository transactionRepository;

    @Value("${application.supplier.commission-rate:0.10}")
    private BigDecimal commissionRate;

    // ── Public API ────────────────────────────────────────────────────────────

    @Override
    @Transactional
    public SupplierBalanceDto getBalance(UUID supplierUserId) {
        SupplierBalance balance = getOrCreateBalance(supplierUserId);
        return toBalanceDto(balance);
    }

    @Override
    @Transactional(readOnly = true)
    public TransactionPageDto getTransactions(UUID supplierUserId, int page, int size) {
        return getTransactions(supplierUserId, page, size, false);
    }

    @Override
    @Transactional(readOnly = true)
    public TransactionPageDto getTransactions(UUID supplierUserId, int page, int size, boolean includeCommission) {
        int safePage = Math.max(0, page);
        int safeSize = Math.max(1, Math.min(size, 100));
        PageRequest pageable = PageRequest.of(safePage, safeSize);

        Page<SupplierTransaction> resultPage = includeCommission
                ? transactionRepository.findBySupplierUserIdOrderByCreatedAtDesc(supplierUserId, pageable)
                : transactionRepository.findBySupplierUserIdAndTypeNotOrderByCreatedAtDesc(
                        supplierUserId,
                        SupplierTransaction.TransactionType.COMMISSION,
                        pageable
                );

        List<SupplierTransactionDto> content = resultPage.getContent().stream()
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
    public void recordOrderIncome(UUID supplierUserId, String orderNumber, String productId, BigDecimal grossAmount) {
        if (grossAmount == null || grossAmount.compareTo(BigDecimal.ZERO) <= 0) {
            log.warn("recordOrderIncome: non-positive grossAmount {} for supplier {}", grossAmount, supplierUserId);
            return;
        }

        BigDecimal commission = grossAmount
                .multiply(commissionRate)
                .setScale(2, RoundingMode.HALF_UP);
        BigDecimal net = grossAmount.subtract(commission).setScale(2, RoundingMode.HALF_UP);

        // Persist transaction
        SupplierTransaction tx = SupplierTransaction.builder()
                .supplierUserId(supplierUserId)
                .orderNumber(orderNumber)
                .productId(productId)
                .type(SupplierTransaction.TransactionType.ORDER_INCOME)
                .grossAmount(grossAmount.setScale(2, RoundingMode.HALF_UP))
                .commissionAmount(commission)
                .netAmount(net)
                .description("Order income: " + orderNumber)
                .build();
        transactionRepository.save(tx);

        // Credit commission transaction (separate row for transparency)
        SupplierTransaction commissionTx = SupplierTransaction.builder()
                .supplierUserId(supplierUserId)
                .orderNumber(orderNumber)
                .productId(productId)
                .type(SupplierTransaction.TransactionType.COMMISSION)
                .grossAmount(commission)
                .commissionAmount(BigDecimal.ZERO)
                .netAmount(commission.negate())
                .description("Platform commission (" +
                        commissionRate.multiply(BigDecimal.valueOf(100)).stripTrailingZeros().toPlainString()
                        + "%): " + orderNumber)
                .build();
        transactionRepository.save(commissionTx);

        // Update balance
        SupplierBalance balance = getOrCreateBalance(supplierUserId);
        balance.setAvailableBalance(
                balance.getAvailableBalance().add(net).setScale(2, RoundingMode.HALF_UP));
        balance.setTotalEarned(
                balance.getTotalEarned().add(net).setScale(2, RoundingMode.HALF_UP));
        balanceRepository.save(balance);

        log.info("Recorded order income for supplier {} order {}: gross={} commission={} net={}",
                supplierUserId, orderNumber, grossAmount, commission, net);
    }

    @Override
    @Transactional
    public void recordRefund(UUID supplierUserId, String orderNumber, BigDecimal amount) {
        if (amount == null || amount.compareTo(BigDecimal.ZERO) <= 0) {
            log.warn("recordRefund: non-positive amount {} for supplier {}", amount, supplierUserId);
            return;
        }

        BigDecimal safeAmount = amount.setScale(2, RoundingMode.HALF_UP);

        SupplierTransaction tx = SupplierTransaction.builder()
                .supplierUserId(supplierUserId)
                .orderNumber(orderNumber)
                .type(SupplierTransaction.TransactionType.REFUND)
                .grossAmount(safeAmount.negate())
                .commissionAmount(BigDecimal.ZERO)
                .netAmount(safeAmount.negate())
                .description("Refund / cancellation: " + orderNumber)
                .build();
        transactionRepository.save(tx);

        SupplierBalance balance = getOrCreateBalance(supplierUserId);
        BigDecimal deduct = safeAmount.min(balance.getAvailableBalance()); // don't go negative
        balance.setAvailableBalance(
                balance.getAvailableBalance().subtract(deduct).setScale(2, RoundingMode.HALF_UP));
        balanceRepository.save(balance);

        log.info("Recorded refund for supplier {} order {}: amount={}", supplierUserId, orderNumber, safeAmount);
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    /**
     * Fetches the existing balance row or creates a fresh zero-balance if it doesn't exist yet.
     * Called inside @Transactional methods so the new row is committed atomically.
     */
    private SupplierBalance getOrCreateBalance(UUID supplierUserId) {
        return balanceRepository.findBySupplierUserId(supplierUserId).orElseGet(() -> {
            try {
                SupplierBalance fresh = SupplierBalance.builder()
                        .supplierUserId(supplierUserId)
                        .availableBalance(BigDecimal.ZERO)
                        .pendingBalance(BigDecimal.ZERO)
                        .totalEarned(BigDecimal.ZERO)
                        .currency("USD")
                        .build();
                return balanceRepository.saveAndFlush(fresh);
            } catch (DataIntegrityViolationException ex) {
                log.debug("Race condition on supplier_balance insert for supplier {}; re-fetching.", supplierUserId);
                return balanceRepository.findBySupplierUserId(supplierUserId)
                        .orElseThrow(() -> new IllegalStateException(
                                "Could not create or load balance for supplier " + supplierUserId, ex));
            }
        });
    }

    private SupplierBalanceDto toBalanceDto(SupplierBalance balance) {
        return SupplierBalanceDto.builder()
                .availableBalance(orZero(balance.getAvailableBalance()))
                .pendingBalance(orZero(balance.getPendingBalance()))
                .totalEarned(orZero(balance.getTotalEarned()))
                .currency(balance.getCurrency())
                .build();
    }

    private SupplierTransactionDto toTransactionDto(SupplierTransaction tx) {
        return SupplierTransactionDto.builder()
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
