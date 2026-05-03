package com.example.shop.modules.supplier.finance.dto;

import lombok.Builder;
import lombok.Getter;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Getter
@Builder
public class SupplierTransactionDto {
    private Long id;
    private String orderNumber;
    private String productId;
    private String type;
    private BigDecimal grossAmount;
    private BigDecimal commissionAmount;
    private BigDecimal netAmount;
    private String description;
    private LocalDateTime createdAt;
}
