package com.example.shop.modules.shipper.dto;

import com.example.shop.modules.shipper.entity.HelpRequestPriority;
import com.example.shop.modules.shipper.entity.HelpRequestStatus;
import com.example.shop.modules.shipper.entity.IssueStatus;
import com.example.shop.modules.shipper.entity.ShipperIssueType;
import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

public final class ShipperDtos {
    private ShipperDtos() {
    }

    @Data
    public static class LocationUpdateRequest {
        private Long orderId;
        private BigDecimal lat;
        private BigDecimal lng;
        private BigDecimal speed;
        private BigDecimal heading;
        private BigDecimal accuracy;
        private Long timestampEpochMs;
    }

    @Data
    @Builder
    public static class LocationPayload {
        private UUID shipperUserId;
        private Long orderId;
        private BigDecimal lat;
        private BigDecimal lng;
        private BigDecimal speed;
        private BigDecimal heading;
        private BigDecimal accuracy;
        private LocalDateTime recordedAt;
    }

    @Data
    @Builder
    public static class OrderTrackingResponse {
        private Long orderId;
        private String orderNumber;
        private String orderStatus;
        private UUID shipperUserId;
        private BigDecimal deliveryLatitude;
        private BigDecimal deliveryLongitude;
        private BigDecimal deliveryLocationAccuracyMeters;
        private Long deliveryLocationCapturedAt;
        private LocalDateTime expectedDeliveryAt;
        private LocalDateTime pickedUpAt;
        private LocalDateTime deliveredAt;
        private LocalDateTime failedAt;
        private String failureReason;
    }

    @Data
    public static class StatusUpdateRequest {
        private String status;
        private LocalDateTime expectedDeliveryAt;
        private String note;
        private String failureReason;
    }

    @Data
    @Builder
    public static class PerformanceResponse {
        private UUID shipperUserId;
        private LocalDateTime from;
        private LocalDateTime to;
        private Long completedDeliveries;
        private Long failedDeliveries;
        private BigDecimal successRatePercent;
        private BigDecimal averageDeliveryMinutes;
        private Long lateDeliveries;
    }

    @Data
    public static class IssueCreateRequest {
        private String issueType;
        private String message;
    }

    @Data
    @Builder
    public static class IssueResponse {
        private Long id;
        private Long orderId;
        private UUID shipperUserId;
        private ShipperIssueType issueType;
        private String message;
        private IssueStatus status;
        private LocalDateTime createdAt;
        private LocalDateTime updatedAt;
    }

    @Data
    public static class HelpRequestCreateRequest {
        private String message;
        private String priority;
    }

    @Data
    @Builder
    public static class HelpRequestResponse {
        private Long id;
        private Long orderId;
        private UUID shipperUserId;
        private String message;
        private HelpRequestPriority priority;
        private HelpRequestStatus status;
        private LocalDateTime createdAt;
    }

    @Data
    @Builder
    public static class IssueListResponse {
        private List<IssueResponse> items;
    }
}
