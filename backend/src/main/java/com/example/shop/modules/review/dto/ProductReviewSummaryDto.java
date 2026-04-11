package com.example.shop.modules.review.dto;

import lombok.Builder;
import lombok.Getter;
import lombok.Setter;

import java.util.List;

@Getter
@Setter
@Builder
public class ProductReviewSummaryDto {

    private String productID;
    private Double averageRating;
    private Integer reviewCount;
    private List<ProductReviewDto> reviews;
}
