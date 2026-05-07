package com.example.shop.modules.seller.finance.dto;

import lombok.Builder;
import lombok.Getter;

import java.util.List;

@Getter
@Builder
public class TransactionPageDto {
    private List<SellerTransactionDto> content;
    private int page;
    private int size;
    private long totalElements;
    private int totalPages;
}

