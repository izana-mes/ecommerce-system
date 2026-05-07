package com.example.shop.modules.selleraccess.dto;

import com.example.shop.modules.selleraccess.entity.SellerAccessRequest;
import com.example.shop.modules.selleraccess.entity.SellerAccessRequestStatus;
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
public class SellerAccessRequestResponseDto {

    private UUID id;
    private SellerAccessRequestStatus status;
    private String businessName;
    private String websiteUrl;
    private String contactPhone;
    private String note;
    private String reviewerNote;
    private LocalDateTime createdAt;
    private LocalDateTime reviewedAt;
    private UUID requestedByUserId;
    private String requestedByEmail;
    private UUID reviewedByUserId;
    private String reviewedByEmail;

    public static SellerAccessRequestResponseDto fromEntity(SellerAccessRequest entity) {
        return SellerAccessRequestResponseDto.builder()
                .id(entity.getId())
                .status(entity.getStatus())
                .businessName(entity.getBusinessName())
                .websiteUrl(entity.getWebsiteUrl())
                .contactPhone(entity.getContactPhone())
                .note(entity.getNote())
                .reviewerNote(entity.getReviewerNote())
                .createdAt(entity.getCreatedAt())
                .reviewedAt(entity.getReviewedAt())
                .requestedByUserId(entity.getRequestedBy() == null ? null : entity.getRequestedBy().getId())
                .requestedByEmail(entity.getRequestedBy() == null ? null : entity.getRequestedBy().getEmail())
                .reviewedByUserId(entity.getReviewedBy() == null ? null : entity.getReviewedBy().getId())
                .reviewedByEmail(entity.getReviewedBy() == null ? null : entity.getReviewedBy().getEmail())
                .build();
    }
}

