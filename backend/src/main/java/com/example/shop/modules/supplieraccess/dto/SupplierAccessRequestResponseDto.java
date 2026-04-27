package com.example.shop.modules.supplieraccess.dto;

import com.example.shop.modules.supplieraccess.entity.SupplierAccessRequest;
import com.example.shop.modules.supplieraccess.entity.SupplierAccessRequestStatus;
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
public class SupplierAccessRequestResponseDto {

    private UUID id;
    private SupplierAccessRequestStatus status;
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

    public static SupplierAccessRequestResponseDto fromEntity(SupplierAccessRequest entity) {
        return SupplierAccessRequestResponseDto.builder()
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
