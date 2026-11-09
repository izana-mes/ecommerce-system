package com.example.shop.modules.resale.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
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
public class CreateListingDto {

    @NotBlank(message = "authorizationId is required")
    private String authorizationId;

    @NotNull(message = "retailPrice is required")
    @DecimalMin(value = "0.01", message = "retailPrice must be positive")
    private BigDecimal retailPrice;

    private String customTitle;
}
