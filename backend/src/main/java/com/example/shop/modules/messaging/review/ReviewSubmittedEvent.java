package com.example.shop.modules.messaging.review;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ReviewSubmittedEvent {

    private String productId;
    private String productName;
    private String reviewId;
    private String author;
    private int rating;
    private String comment;
    private String customerEmail;

    @Builder.Default
    private LocalDateTime submittedAt = LocalDateTime.now();
}
