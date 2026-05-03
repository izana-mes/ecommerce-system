package com.example.shop.modules.staff.dto;

import java.time.LocalDateTime;

public record IssueDto(
        Long id,
        /** "LOG" = shipper_issue_logs | "HELP" = shipper_help_requests */
        String sourceTable,
        Long orderId,
        String orderNumber,
        String shipperUserId,
        String shipperEmail,
        String issueType,
        String message,
        String priority,
        String status,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {}
