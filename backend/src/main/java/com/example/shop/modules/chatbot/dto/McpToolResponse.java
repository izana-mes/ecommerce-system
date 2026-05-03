package com.example.shop.modules.chatbot.dto;

import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

/**
 * Response DTO for MCP tool endpoint responses.
 * Structured for direct consumption by the MCP server / LLM function-calling loop.
 */
public class McpToolResponse {

    // -----------------------------------------------------------------------
    // Product tool responses
    // -----------------------------------------------------------------------

    @Data
    @Builder
    public static class ProductResult {
        private String productId;
        private String productName;
        private Double price;
        private Integer stockQuantity;
        private Boolean available;
        private List<String> sizes;
        private String imageUrl;
    }

    @Data
    @Builder
    public static class ProductSearchResult {
        private int totalFound;
        private int page;
        private int size;
        private List<ProductResult> products;
    }

    // -----------------------------------------------------------------------
    // Order tool responses
    // -----------------------------------------------------------------------

    @Data
    @Builder
    public static class OrderSummary {
        private String orderNumber;
        private String orderStatus;
        private String paymentStatus;
        private String paymentMethod;
        private BigDecimal totalAmount;
        private String currency;
        private int itemCount;
        private LocalDateTime createdAt;
        private String shippingCarrier;
        private String shippingTrackingPublic;
    }

    @Data
    @Builder
    public static class OrderListResult {
        private int total;
        private List<OrderSummary> orders;
    }

    // -----------------------------------------------------------------------
    // Action responses
    // -----------------------------------------------------------------------

    @Data
    @Builder
    public static class ActionResult {
        private boolean success;
        private String message;
        private String orderNumber;
        private String status;
    }

    @Data
    @Builder
    public static class ReturnRequestResult {
        private boolean success;
        private Long requestId;
        private String orderNumber;
        private String status;
        private String message;
    }

    // -----------------------------------------------------------------------
    // Tool error response
    // -----------------------------------------------------------------------

    @Data
    @Builder
    public static class ToolError {
        private boolean success;
        private String errorCode;
        private String message;
    }
}
