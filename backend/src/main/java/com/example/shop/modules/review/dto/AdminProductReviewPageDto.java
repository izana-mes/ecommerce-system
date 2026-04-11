package com.example.shop.modules.review.dto;

import lombok.Builder;
import lombok.Getter;
import lombok.Setter;

import java.util.List;

@Getter
@Setter
@Builder
public class AdminProductReviewPageDto {

    private List<AdminProductReviewItemDto> content;
    private long totalElements;
    private int totalPages;
    private int number;
    private int size;
}
