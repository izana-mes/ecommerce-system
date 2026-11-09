package com.example.shop.modules.resale.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SellerProfileDto {
    private UUID sellerId;
    private String storeName;
    private String businessDescription;
    private String websiteUrl;
    private LocalDateTime memberSince;
    private boolean emailVerified;
    private int activeListingCount;
    private int activePartnershipCount;
    private int totalRequestsSubmitted;
    private List<ResaleRequestResponseDto> previousRequests;
    private List<ResaleAuthorizationDto> activePartnerships;
}
