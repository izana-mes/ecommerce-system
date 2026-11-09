package com.example.shop.modules.resale.dto;

import jakarta.validation.constraints.DecimalMin;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UpdateListingDto {
    @DecimalMin(value = "0.01", message = "retailPrice must be positive")
    private BigDecimal retailPrice;
    private String customTitle;
    private Boolean active;
}
