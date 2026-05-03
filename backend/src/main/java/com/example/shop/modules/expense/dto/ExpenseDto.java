package com.example.shop.modules.expense.dto;

import lombok.Builder;
import lombok.Value;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Value
@Builder
public class ExpenseDto {
    Long id;
    BigDecimal amount;
    String currency;
    String category;
    String description;
    LocalDate spentOn;
    LocalDateTime createdAt;
    LocalDateTime updatedAt;
}
