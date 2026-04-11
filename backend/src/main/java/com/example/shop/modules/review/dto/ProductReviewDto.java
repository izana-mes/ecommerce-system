package com.example.shop.modules.review.dto;

import lombok.Builder;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
@Builder
public class ProductReviewDto {

    private String id;
    private Integer rating;
    private String comment;
    private String author;
    private String authorId;
    private Boolean ownedByCurrentUser;
    private String createdAt;
}
