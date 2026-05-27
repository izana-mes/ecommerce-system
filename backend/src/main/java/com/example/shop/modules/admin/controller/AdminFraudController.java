package com.example.shop.modules.admin.controller;

import com.example.shop.common.response.ApiResponse;
import com.example.shop.modules.admin.dto.AdminFraudAssessmentPageResponse;
import com.example.shop.modules.admin.service.AdminFraudService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/admin")
@RequiredArgsConstructor
public class AdminFraudController {

    private final AdminFraudService adminFraudService;

    @GetMapping("/fraud-assessments")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<AdminFraudAssessmentPageResponse>> getFraudAssessments(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(required = false) String riskLevel,
            @RequestParam(required = false) Boolean manualReviewRequired,
            @RequestParam(required = false) String orderNumber,
            @RequestParam(required = false) String customerEmail
    ) {
        AdminFraudAssessmentPageResponse response = adminFraudService.getFraudAssessments(
                page,
                size,
                riskLevel,
                manualReviewRequired,
                orderNumber,
                customerEmail
        );
        return ResponseEntity.ok(ApiResponse.success(response));
    }

    @PatchMapping("/fraud-assessments/{orderId}/review")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<String>> reviewFraudAssessment(
            @PathVariable long orderId,
            @RequestBody ReviewRequest body,
            Authentication authentication
    ) {
        if (body == null || body.getReviewStatus() == null || body.getReviewStatus().isBlank()) {
            return ResponseEntity.badRequest().body(ApiResponse.error("reviewStatus is required"));
        }

        String reviewedBy = authentication != null ? authentication.getName() : "admin";
        try {
            boolean updated = adminFraudService.reviewAssessment(
                    orderId,
                    body.getReviewStatus(),
                    body.getReviewNote(),
                    reviewedBy
            );
            if (!updated) {
                return ResponseEntity.status(404).body(ApiResponse.error("Fraud assessment not found"));
            }
            return ResponseEntity.ok(ApiResponse.success("Fraud assessment reviewed"));
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.badRequest().body(ApiResponse.error(ex.getMessage()));
        }
    }

    @lombok.Data
    @lombok.NoArgsConstructor
    public static class ReviewRequest {
        private String reviewStatus;
        private String reviewNote;
    }
}
