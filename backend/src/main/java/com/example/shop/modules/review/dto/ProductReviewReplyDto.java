package com.example.shop.modules.review.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ProductReviewReplyDto {
    private String id;
    private String author;
    private String content;
    private String createdAt;
}
