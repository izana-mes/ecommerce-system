package com.example.shop.modules.resale.dto;

import com.example.shop.modules.resale.entity.SellerResaleRequest;
import com.example.shop.modules.user.entity.User;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ResaleRequestResponseDto {
    private UUID id;
    private String supplierProductId;
    private String supplierProductName;
    private String supplierProductImage;
    private Double supplierProductPrice;
    private UUID sellerUserId;
    private String sellerDisplayName;
    private String sellerEmail;
    private UUID supplierUserId;
    private String supplierDisplayName;
    private String proposalMessage;
    private BigDecimal proposedRetailPrice;
    private Integer initialAllocationQuantity;
    private Integer minimumOrderQuantity;
    private Integer availableInventory;
    private String status;
    private String reviewerNote;
    private LocalDateTime reviewedAt;
    private LocalDateTime cancelledAt;
    private String cancelReason;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    public static ResaleRequestResponseDto fromEntity(SellerResaleRequest e) {
        return ResaleRequestResponseDto.builder()
                .id(e.getId())
                .supplierProductId(e.getSupplierProductId())
                .sellerUserId(e.getSeller() == null ? null : e.getSeller().getId())
                .sellerDisplayName(e.getSeller() == null ? null : displayName(e.getSeller()))
                .sellerEmail(e.getSeller() == null ? null : e.getSeller().getEmail())
                .supplierUserId(e.getSupplierUserId())
                .proposalMessage(e.getProposalMessage())
                .proposedRetailPrice(e.getProposedRetailPrice())
                .status(e.getStatus() == null ? null : e.getStatus().name())
                .reviewerNote(e.getReviewerNote())
                .reviewedAt(e.getReviewedAt())
                .cancelledAt(e.getCancelledAt())
                .cancelReason(e.getCancelReason())
                .createdAt(e.getCreatedAt())
                .updatedAt(e.getUpdatedAt())
                .build();
    }

    private static String displayName(User user) {
        if (user == null) return null;
        String full = ((user.getFirstName() == null ? "" : user.getFirstName().trim())
                + " " + (user.getLastName() == null ? "" : user.getLastName().trim())).trim();
        return full.isBlank() ? user.getEmail() : full;
    }
}
