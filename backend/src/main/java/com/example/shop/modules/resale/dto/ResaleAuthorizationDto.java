package com.example.shop.modules.resale.dto;

import com.example.shop.modules.resale.entity.SellerResaleAuthorization;
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
public class ResaleAuthorizationDto {
    private UUID id;
    private UUID resaleRequestId;
    private String supplierProductId;
    private String supplierProductName;
    private String supplierProductImage;
    private Double supplierProductPrice;
    private UUID sellerUserId;
    private String sellerDisplayName;
    private String sellerEmail;
    private UUID supplierUserId;
    private String supplierDisplayName;
    private UUID grantedByUserId;
    private LocalDateTime grantedAt;
    private Boolean active;
    private LocalDateTime revokedAt;
    private String revokeReason;
    private LocalDateTime createdAt;

    public static ResaleAuthorizationDto fromEntity(SellerResaleAuthorization e) {
        return ResaleAuthorizationDto.builder()
                .id(e.getId())
                .resaleRequestId(e.getResaleRequest() == null ? null : e.getResaleRequest().getId())
                .supplierProductId(e.getSupplierProductId())
                .sellerUserId(e.getSeller() == null ? null : e.getSeller().getId())
                .sellerDisplayName(e.getSeller() == null ? null : displayName(e.getSeller()))
                .sellerEmail(e.getSeller() == null ? null : e.getSeller().getEmail())
                .supplierUserId(e.getSupplierUserId())
                .grantedByUserId(e.getGrantedBy() == null ? null : e.getGrantedBy().getId())
                .grantedAt(e.getGrantedAt())
                .active(e.getActive())
                .revokedAt(e.getRevokedAt())
                .revokeReason(e.getRevokeReason())
                .createdAt(e.getCreatedAt())
                .build();
    }

    private static String displayName(User user) {
        if (user == null) return null;
        String full = ((user.getFirstName() == null ? "" : user.getFirstName().trim())
                + " " + (user.getLastName() == null ? "" : user.getLastName().trim())).trim();
        return full.isBlank() ? user.getEmail() : full;
    }
}
