package com.example.shop.modules.review.service;

import com.example.shop.modules.review.dto.ProductReviewRequest;
import com.example.shop.modules.review.dto.ProductReviewSummaryDto;
import com.example.shop.modules.review.dto.AdminProductReviewPageDto;
import com.example.shop.modules.review.dto.ProductReviewDto;

public interface ProductReviewService {

    ProductReviewSummaryDto getReviews(String productID, int limit, Object principal);

    ProductReviewSummaryDto addReview(String productID, ProductReviewRequest request, Object principal);

    ProductReviewSummaryDto updateReview(String productID, String reviewID, ProductReviewRequest request, Object principal);

    ProductReviewSummaryDto deleteReview(String productID, String reviewID, Object principal);

    ProductReviewSummaryDto addDislike(String productID, String reviewID, Object principal);

    ProductReviewSummaryDto toggleLike(String productID, String reviewID, Object principal);

    ProductReviewSummaryDto addReply(String productID, String reviewID, com.example.shop.modules.review.dto.ProductReviewReplyDto replyDto, Object principal);

    AdminProductReviewPageDto getReviewsForAdmin(String query, int page, int size);

    ProductReviewDto updateReviewAsAdmin(String productID, String reviewID, ProductReviewRequest request);

    void deleteReviewAsAdmin(String productID, String reviewID);
}
