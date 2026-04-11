package com.example.shop.modules.review.dto;

import lombok.Builder;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
@Builder
public class AdminProductReviewItemDto {

    private String productID;
    private String reviewID;
    private String author;
    private Integer rating;
    private String comment;
    private String createdAt;
}
