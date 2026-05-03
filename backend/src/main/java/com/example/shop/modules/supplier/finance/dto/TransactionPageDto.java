package com.example.shop.modules.supplier.finance.dto;

import lombok.Builder;
import lombok.Getter;

import java.util.List;

@Getter
@Builder
public class TransactionPageDto {
    private List<SupplierTransactionDto> content;
    private int page;
    private int size;
    private long totalElements;
    private int totalPages;
}
