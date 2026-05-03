package com.example.shop.modules.expense.dto;

import lombok.Builder;
import lombok.Value;

import java.math.BigDecimal;
import java.util.List;

@Value
@Builder
public class ExpensePageDto {
    List<ExpenseDto> content;
    int page;
    int size;
    long totalElements;
    int totalPages;
    /** Sum of amounts on the current page only (same currency assumed USD for mixed). */
    BigDecimal pageTotal;
}
