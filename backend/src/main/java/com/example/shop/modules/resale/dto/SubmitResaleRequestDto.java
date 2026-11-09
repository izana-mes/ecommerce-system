package com.example.shop.modules.resale.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SubmitResaleRequestDto {

    @NotBlank(message = "supplierProductId is required")
    private String supplierProductId;

    private String proposalMessage;

    @NotNull(message = "proposedRetailPrice is required")
    @DecimalMin(value = "0.01", message = "proposedRetailPrice must be positive")
    private BigDecimal proposedRetailPrice;
}
