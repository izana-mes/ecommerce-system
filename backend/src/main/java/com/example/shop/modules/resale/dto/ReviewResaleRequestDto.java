package com.example.shop.modules.resale.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ReviewResaleRequestDto {
    private String note;
    private Integer initialAllocationQuantity;
}
