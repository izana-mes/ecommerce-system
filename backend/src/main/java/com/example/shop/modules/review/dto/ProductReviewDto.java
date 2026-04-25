package com.example.shop.modules.review.dto;

import lombok.Builder;
import lombok.Getter;
import lombok.Setter;
import java.util.Set;
import java.util.List;

@Getter
@Setter
@Builder
public class ProductReviewDto {

    private String id;
    private Integer rating;
    private String comment;
    private String author;
    private String authorId;
    private Integer dislikes;
    private Integer likes;
    private Boolean likedByCurrentUser;
    private Set<String> likedByUsers;
    private List<ProductReviewReplyDto> replies;
    private String createdAt;
    private Boolean ownedByCurrentUser;
}
