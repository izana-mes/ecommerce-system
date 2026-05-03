package com.example.shop.modules.expense.service;

import com.example.shop.modules.expense.dto.ExpenseCreateRequest;
import com.example.shop.modules.expense.dto.ExpenseDto;
import com.example.shop.modules.expense.dto.ExpensePageDto;
import com.example.shop.modules.expense.dto.ExpenseUpdateRequest;
import com.example.shop.modules.expense.entity.UserExpense;
import com.example.shop.modules.expense.repository.UserExpenseRepository;
import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class ExpenseServiceImpl implements ExpenseService {

    private final UserExpenseRepository expenseRepository;

    @Override
    @Transactional(readOnly = true)
    public ExpensePageDto list(UUID userId, int page, int size) {
        int safePage = Math.max(0, page);
        int safeSize = Math.max(1, Math.min(size, 100));
        Page<UserExpense> result = expenseRepository.findByUserIdOrderBySpentOnDescIdDesc(
                userId, PageRequest.of(safePage, safeSize));
        List<ExpenseDto> content = result.getContent().stream().map(this::toDto).toList();
        BigDecimal pageTotal = result.getContent().stream()
                .map(UserExpense::getAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add)
                .setScale(2, RoundingMode.HALF_UP);
        return ExpensePageDto.builder()
                .content(content)
                .page(safePage)
                .size(safeSize)
                .totalElements(result.getTotalElements())
                .totalPages(result.getTotalPages())
                .pageTotal(pageTotal)
                .build();
    }

    @Override
    @Transactional
    public ExpenseDto create(UUID userId, ExpenseCreateRequest request) {
        String currency = normalizeCurrency(request.getCurrency());
        LocalDate spentOn = request.getSpentOn() != null ? request.getSpentOn() : LocalDate.now();
        UserExpense row = UserExpense.builder()
                .userId(userId)
                .amount(request.getAmount().setScale(2, RoundingMode.HALF_UP))
                .currency(currency)
                .category(request.getCategory().trim())
                .description(trimToNull(request.getDescription()))
                .spentOn(spentOn)
                .build();
        return toDto(expenseRepository.save(row));
    }

    @Override
    @Transactional
    public ExpenseDto update(UUID userId, Long id, ExpenseUpdateRequest request) {
        UserExpense row = expenseRepository.findByIdAndUserId(id, userId)
                .orElseThrow(() -> new EntityNotFoundException("Expense not found"));
        row.setAmount(request.getAmount().setScale(2, RoundingMode.HALF_UP));
        row.setCurrency(normalizeCurrency(request.getCurrency()));
        row.setCategory(request.getCategory().trim());
        row.setDescription(trimToNull(request.getDescription()));
        row.setSpentOn(request.getSpentOn());
        return toDto(expenseRepository.save(row));
    }

    @Override
    @Transactional
    public void delete(UUID userId, Long id) {
        UserExpense row = expenseRepository.findByIdAndUserId(id, userId)
                .orElseThrow(() -> new EntityNotFoundException("Expense not found"));
        expenseRepository.delete(row);
    }

    private static String normalizeCurrency(String currency) {
        if (currency == null || currency.isBlank()) {
            return "USD";
        }
        return currency.trim().toUpperCase();
    }

    private static String trimToNull(String s) {
        if (s == null) return null;
        String t = s.trim();
        return t.isEmpty() ? null : t;
    }

    private ExpenseDto toDto(UserExpense e) {
        return ExpenseDto.builder()
                .id(e.getId())
                .amount(e.getAmount())
                .currency(e.getCurrency())
                .category(e.getCategory())
                .description(e.getDescription())
                .spentOn(e.getSpentOn())
                .createdAt(e.getCreatedAt())
                .updatedAt(e.getUpdatedAt())
                .build();
    }
}
