package com.example.shop.modules.seller.finance.dto;

import lombok.Builder;
import lombok.Getter;

import java.math.BigDecimal;

@Getter
@Builder
public class SellerBalanceDto {
    private BigDecimal availableBalance;
    private BigDecimal pendingBalance;
    private BigDecimal totalEarned;
    private String currency;
}

