package com.example.shop.modules.expense.service;

import com.example.shop.modules.expense.dto.ExpenseCreateRequest;
import com.example.shop.modules.expense.dto.ExpenseDto;
import com.example.shop.modules.expense.dto.ExpensePageDto;
import com.example.shop.modules.expense.dto.ExpenseUpdateRequest;

import java.util.UUID;

public interface ExpenseService {

    ExpensePageDto list(UUID userId, int page, int size);

    ExpenseDto create(UUID userId, ExpenseCreateRequest request);

    ExpenseDto update(UUID userId, Long id, ExpenseUpdateRequest request);

    void delete(UUID userId, Long id);
}
