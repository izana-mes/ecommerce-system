package com.example.shop.modules.seller.finance.controller;

import com.example.shop.common.response.ApiResponse;
import com.example.shop.modules.seller.finance.dto.SellerBalanceDto;
import com.example.shop.modules.seller.finance.dto.TransactionPageDto;
import com.example.shop.modules.seller.finance.service.SellerFinanceService;
import com.example.shop.modules.user.entity.User;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/seller/finance")
@RequiredArgsConstructor
public class SellerFinanceController {

    private final SellerFinanceService financeService;

    /**
     * GET /api/v1/seller/finance/balance
     *
     * Returns the authenticated seller's current balance.
     *
     * Example response:
     * {
     *   "success": true,
     *   "data": {
     *     "availableBalance": 1100.00,
     *     "pendingBalance": 0.00,
     *     "totalEarned": 1250.00,
     *     "currency": "USD"
     *   }
     * }
     */
    @GetMapping("/balance")
    @PreAuthorize("hasRole('SELLER')")
    public ResponseEntity<ApiResponse<SellerBalanceDto>> getBalance(
            @AuthenticationPrincipal User user
    ) {
        SellerBalanceDto balance = financeService.getBalance(user.getId());
        return ResponseEntity.ok(ApiResponse.success(balance));
    }

    /**
     * GET /api/v1/seller/finance/transactions?page=0&size=20
     *
     * Returns a paginated transaction history for the authenticated seller.
     *
     * Example response:
     * {
     *   "success": true,
     *   "data": {
     *     "content": [
     *       {
     *         "id": 1,
     *         "orderNumber": "ORD-0001234567-0001",
     *         "productId": "P001",
     *         "type": "ORDER_INCOME",
     *         "grossAmount": 100.00,
     *         "commissionAmount": 10.00,
     *         "netAmount": 90.00,
     *         "description": "Order income: ORD-0001234567-0001",
     *         "createdAt": "2026-05-03T10:00:00"
     *       }
     *     ],
     *     "page": 0,
     *     "size": 20,
     *     "totalElements": 1,
     *     "totalPages": 1
     *   }
     * }
     */
    @GetMapping("/transactions")
    @PreAuthorize("hasRole('SELLER')")
    public ResponseEntity<ApiResponse<TransactionPageDto>> getTransactions(
            @AuthenticationPrincipal User user,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(required = false) String type
    ) {
        TransactionPageDto transactions = financeService.getTransactions(user.getId(), page, size, type);
        return ResponseEntity.ok(ApiResponse.success(transactions));
    }
}

