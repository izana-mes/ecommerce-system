package com.example.shop.modules.expense.controller;

import com.example.shop.common.response.ApiResponse;
import com.example.shop.modules.expense.dto.ExpenseCreateRequest;
import com.example.shop.modules.expense.dto.ExpenseDto;
import com.example.shop.modules.expense.dto.ExpensePageDto;
import com.example.shop.modules.expense.dto.ExpenseUpdateRequest;
import com.example.shop.modules.expense.service.ExpenseService;
import com.example.shop.modules.user.entity.User;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/me/expenses")
@RequiredArgsConstructor
public class MeExpenseController {

    private final ExpenseService expenseService;

    @GetMapping
    public ResponseEntity<ApiResponse<ExpensePageDto>> list(
            @AuthenticationPrincipal User user,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size
    ) {
        ExpensePageDto data = expenseService.list(user.getId(), page, size);
        return ResponseEntity.ok(ApiResponse.success(data));
    }

    @PostMapping
    public ResponseEntity<ApiResponse<ExpenseDto>> create(
            @AuthenticationPrincipal User user,
            @Valid @RequestBody ExpenseCreateRequest request
    ) {
        ExpenseDto created = expenseService.create(user.getId(), request);
        return ResponseEntity.ok(ApiResponse.success(created));
    }

    @PutMapping("/{id}")
    public ResponseEntity<ApiResponse<ExpenseDto>> update(
            @AuthenticationPrincipal User user,
            @PathVariable Long id,
            @Valid @RequestBody ExpenseUpdateRequest request
    ) {
        ExpenseDto updated = expenseService.update(user.getId(), id, request);
        return ResponseEntity.ok(ApiResponse.success(updated));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<ApiResponse<Void>> delete(
            @AuthenticationPrincipal User user,
            @PathVariable Long id
    ) {
        expenseService.delete(user.getId(), id);
        return ResponseEntity.ok(ApiResponse.success(null));
    }
}
