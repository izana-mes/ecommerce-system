package com.example.shop.modules.seller.inventory.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.List;

@Getter
@Setter
@NoArgsConstructor
public class BulkStockUpdateRequest {

    @NotEmpty(message = "updates list must not be empty")
    @Valid
    private List<StockUpdateRequest> updates;
}
