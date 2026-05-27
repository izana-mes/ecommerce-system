package com.example.shop.modules.admin.dto;

import java.io.Serializable;
import java.math.BigDecimal;
import java.util.List;

public record AdminFraudAssessmentPageResponse(
        List<Item> content,
        long totalElements,
        long totalPages,
        int number,
        int size,
        boolean unavailable
) implements Serializable {

    public record Item(
            long orderId,
            String orderNumber,
            String customerEmail,
            String paymentMethod,
            String currency,
            BigDecimal totalAmount,
            int riskScore,
            String riskLevel,
            boolean manualReviewRequired,
            String riskReasons,
            String reviewStatus,
            String reviewNote,
            String reviewedBy,
            String reviewedAt,
            String assessedAt,
            String updatedAt
    ) implements Serializable {
    }
}
