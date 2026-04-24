package com.example.shop.modules.productapproval.dto;

import com.example.shop.modules.productapproval.entity.ProductChangeAction;
import com.example.shop.modules.productapproval.entity.ProductChangeRequest;
import com.example.shop.modules.productapproval.entity.ProductChangeRequestStatus;
import com.example.shop.modules.user.entity.User;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ProductChangeRequestResponseDto {

    private UUID id;
    private ProductChangeAction actionType;
    private String targetProductId;
    private String requestPayload;
    private ProductChangeRequestStatus status;
    private UUID requestedByUserId;
    private String requestedByEmail;
    private UUID reviewedByUserId;
    private String reviewedByEmail;
    private String reviewerNote;
    private LocalDateTime reviewedAt;
    private LocalDateTime createdAt;

    public static ProductChangeRequestResponseDto fromEntity(ProductChangeRequest entity) {
        User requestedBy = entity.getRequestedBy();
        User reviewedBy = entity.getReviewedBy();
        return ProductChangeRequestResponseDto.builder()
                .id(entity.getId())
                .actionType(entity.getActionType())
                .targetProductId(entity.getTargetProductId())
                .requestPayload(entity.getRequestPayload())
                .status(entity.getStatus())
                .requestedByUserId(requestedBy == null ? null : requestedBy.getId())
                .requestedByEmail(requestedBy == null ? null : requestedBy.getEmail())
                .reviewedByUserId(reviewedBy == null ? null : reviewedBy.getId())
                .reviewedByEmail(reviewedBy == null ? null : reviewedBy.getEmail())
                .reviewerNote(entity.getReviewerNote())
                .reviewedAt(entity.getReviewedAt())
                .createdAt(entity.getCreatedAt())
                .build();
    }
}
