package com.example.shop.modules.chatbot.controller;

import com.example.shop.modules.chatbot.dto.McpToolResponse;
import com.example.shop.modules.chatbot.entity.ChatbotReturnRequest;
import com.example.shop.modules.chatbot.repository.ChatbotReturnRequestRepository;
import com.example.shop.modules.order.dto.OrderHistoryItemDto;
import com.example.shop.modules.order.service.OrderService;
import com.example.shop.modules.product.dto.ProductDto;
import com.example.shop.modules.product.service.ProductService;
import com.example.shop.modules.user.entity.User;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.util.StringUtils;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * MCP Tool Endpoints — ALL access is gated by McpServiceTokenFilter.
 *
 * These endpoints are NOT called by the customer browser directly.
 * They are called by the MCP Server (or the ChatbotAiClient tool-calling loop)
 * which presents the shared X-MCP-Service-Token header.
 *
 * No raw DB access — everything delegates to the service layer.
 */
@RestController
@RequestMapping("/api/chatbot/tools")
@RequiredArgsConstructor
@Slf4j
public class ChatbotToolController {

    private final OrderService orderService;
    private final ProductService productService;
    private final ChatbotReturnRequestRepository returnRequestRepository;

    // -----------------------------------------------------------------------
    // Tool 1: getUserOrders
    // GET /api/chatbot/tools/orders?email=&limit=
    // -----------------------------------------------------------------------

    @GetMapping("/orders")
    public ResponseEntity<?> getUserOrders(
            @RequestParam String email,
            @RequestParam(defaultValue = "5") int limit
    ) {
        if (!StringUtils.hasText(email) || !isValidEmail(email)) {
            return badRequest("email is required and must be a valid email address");
        }
        int safeLimit = Math.min(Math.max(limit, 1), 20);

        try {
            User syntheticUser = syntheticUser(email);
            List<OrderHistoryItemDto> orders = orderService.getMyOrders(syntheticUser, safeLimit);

            List<McpToolResponse.OrderSummary> summaries = orders.stream()
                    .map(o -> McpToolResponse.OrderSummary.builder()
                            .orderNumber(o.getOrderNumber())
                            .orderStatus(o.getOrderStatus())
                            .paymentStatus(o.getPaymentStatus())
                            .paymentMethod(o.getPaymentMethod())
                            .totalAmount(o.getTotalAmount())
                            .currency(o.getCurrency())
                            .itemCount(o.getItemCount())
                            .createdAt(o.getCreatedAt())
                            .shippingCarrier(o.getShippingCarrier())
                            .shippingTrackingPublic(o.getShippingTrackingPublic())
                            .build())
                    .toList();

            log.info("mcp_tool=getUserOrders email_hash={} count={}", email.hashCode(), summaries.size());
            return ResponseEntity.ok(McpToolResponse.OrderListResult.builder()
                    .total(summaries.size())
                    .orders(summaries)
                    .build());
        } catch (Exception e) {
            log.error("mcp_tool=getUserOrders error={}", e.getMessage());
            return toolError("ORDER_LOOKUP_ERROR", e.getMessage());
        }
    }

    // -----------------------------------------------------------------------
    // Tool 2: getOrderDetail
    // GET /api/chatbot/tools/orders/{orderNumber}?email=
    // -----------------------------------------------------------------------

    @GetMapping("/orders/{orderNumber}")
    public ResponseEntity<?> getOrderDetail(
            @PathVariable String orderNumber,
            @RequestParam String email
    ) {
        if (!StringUtils.hasText(orderNumber)) {
            return badRequest("orderNumber is required");
        }
        if (!StringUtils.hasText(email) || !isValidEmail(email)) {
            return badRequest("email is required for ownership verification");
        }

        try {
            User syntheticUser = syntheticUser(email);
            // Use customer-scoped lookup — verifies ownership via email
            Optional<com.example.shop.modules.order.dto.OrderTrackingDto> tracking =
                    orderService.getOrderTrackingByNumberForCustomer(orderNumber.trim().toUpperCase(), syntheticUser);

            if (tracking.isEmpty()) {
                return ResponseEntity.status(HttpStatus.NOT_FOUND)
                        .body(McpToolResponse.ToolError.builder()
                                .success(false)
                                .errorCode("ORDER_NOT_FOUND")
                                .message("Order " + orderNumber + " not found for this customer")
                                .build());
            }

            log.info("mcp_tool=getOrderDetail orderNumber={} email_hash={}", orderNumber, email.hashCode());
            return ResponseEntity.ok(tracking.get());
        } catch (Exception e) {
            log.error("mcp_tool=getOrderDetail orderNumber={} error={}", orderNumber, e.getMessage());
            return toolError("ORDER_DETAIL_ERROR", e.getMessage());
        }
    }

    // -----------------------------------------------------------------------
    // Tool 3: searchProducts
    // GET /api/chatbot/tools/products?q=&minPrice=&maxPrice=&category=&page=&size=
    // -----------------------------------------------------------------------

    @GetMapping("/products")
    public ResponseEntity<?> searchProducts(
            @RequestParam(required = false) String q,
            @RequestParam(required = false) Double minPrice,
            @RequestParam(required = false) Double maxPrice,
            @RequestParam(required = false) String category,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size
    ) {
        int safeSize = Math.min(Math.max(size, 1), 20);
        int safePage = Math.max(page, 0);

        try {
            String keyword = StringUtils.hasText(q) ? q.trim() : "";
            List<ProductDto> all = keyword.isBlank()
                    ? productService.getAllProducts()
                    : productService.searchProducts(keyword);

            // Apply server-side price range filter
            List<ProductDto> filtered = all.stream()
                    .filter(p -> Boolean.TRUE.equals(p.getActive()))
                    .filter(p -> minPrice == null || (p.getProductPrice() != null && p.getProductPrice() >= minPrice))
                    .filter(p -> maxPrice == null || (p.getProductPrice() != null && p.getProductPrice() <= maxPrice))
                    .toList();

            // Paginate
            int fromIndex = safePage * safeSize;
            int toIndex = Math.min(fromIndex + safeSize, filtered.size());
            List<ProductDto> page0 = fromIndex >= filtered.size() ? List.of() : filtered.subList(fromIndex, toIndex);

            List<McpToolResponse.ProductResult> results = page0.stream()
                    .map(p -> McpToolResponse.ProductResult.builder()
                            .productId(p.getProductID())
                            .productName(p.getProductName())
                            .price(p.getProductPrice())
                            .stockQuantity(p.getStockQuantity())
                            .available(p.getStockQuantity() != null && p.getStockQuantity() > 0)
                            .sizes(p.getSizes())
                            .imageUrl(p.getFrontImg())
                            .build())
                    .toList();

            log.info("mcp_tool=searchProducts q={} minPrice={} maxPrice={} found={}", keyword, minPrice, maxPrice, filtered.size());
            return ResponseEntity.ok(McpToolResponse.ProductSearchResult.builder()
                    .totalFound(filtered.size())
                    .page(safePage)
                    .size(safeSize)
                    .products(results)
                    .build());
        } catch (Exception e) {
            log.error("mcp_tool=searchProducts error={}", e.getMessage());
            return toolError("PRODUCT_SEARCH_ERROR", e.getMessage());
        }
    }

    // -----------------------------------------------------------------------
    // Tool 4: recommendProducts
    // GET /api/chatbot/tools/products/recommend?email=
    // -----------------------------------------------------------------------

    @GetMapping("/products/recommend")
    public ResponseEntity<?> recommendProducts(
            @RequestParam(required = false) String email
    ) {
        try {
            // Strategy: top 6 active in-stock products (sorted by name)
            // Can be upgraded to collaborative filtering later.
            List<ProductDto> all = productService.getAllProducts();
            List<McpToolResponse.ProductResult> recommendations = all.stream()
                    .filter(p -> Boolean.TRUE.equals(p.getActive()))
                    .filter(p -> p.getStockQuantity() != null && p.getStockQuantity() > 0)
                    .limit(6)
                    .map(p -> McpToolResponse.ProductResult.builder()
                            .productId(p.getProductID())
                            .productName(p.getProductName())
                            .price(p.getProductPrice())
                            .stockQuantity(p.getStockQuantity())
                            .available(true)
                            .sizes(p.getSizes())
                            .imageUrl(p.getFrontImg())
                            .build())
                    .toList();

            log.info("mcp_tool=recommendProducts email_hash={} count={}", email != null ? email.hashCode() : 0, recommendations.size());
            return ResponseEntity.ok(McpToolResponse.ProductSearchResult.builder()
                    .totalFound(recommendations.size())
                    .page(0)
                    .size(6)
                    .products(recommendations)
                    .build());
        } catch (Exception e) {
            log.error("mcp_tool=recommendProducts error={}", e.getMessage());
            return toolError("RECOMMEND_ERROR", e.getMessage());
        }
    }

    // -----------------------------------------------------------------------
    // Tool 5: cancelOrder
    // POST /api/chatbot/tools/orders/{orderNumber}/cancel
    // Body: { "email": "customer@example.com" }
    // -----------------------------------------------------------------------

    @PostMapping("/orders/{orderNumber}/cancel")
    public ResponseEntity<?> cancelOrder(
            @PathVariable String orderNumber,
            @RequestBody Map<String, String> body
    ) {
        String email = body == null ? null : body.get("email");
        if (!StringUtils.hasText(orderNumber)) {
            return badRequest("orderNumber is required");
        }
        if (!StringUtils.hasText(email) || !isValidEmail(email)) {
            return badRequest("email is required for ownership verification");
        }

        try {
            User syntheticUser = syntheticUser(email);
            orderService.cancelOrder(orderNumber.trim().toUpperCase(), syntheticUser);

            log.info("mcp_tool=cancelOrder orderNumber={} email_hash={}", orderNumber, email.hashCode());
            return ResponseEntity.ok(McpToolResponse.ActionResult.builder()
                    .success(true)
                    .orderNumber(orderNumber.toUpperCase())
                    .status("cancelled")
                    .message("Order " + orderNumber.toUpperCase() + " has been cancelled successfully")
                    .build());
        } catch (com.example.shop.common.exception.BusinessException be) {
            log.warn("mcp_tool=cancelOrder business_error orderNumber={} message={}", orderNumber, be.getMessage());
            return ResponseEntity.status(be.getStatus())
                    .body(McpToolResponse.ActionResult.builder()
                            .success(false)
                            .orderNumber(orderNumber.toUpperCase())
                            .message(be.getMessage())
                            .build());
        } catch (Exception e) {
            log.error("mcp_tool=cancelOrder error={}", e.getMessage());
            return toolError("CANCEL_ORDER_ERROR", e.getMessage());
        }
    }

    // -----------------------------------------------------------------------
    // Tool 6: createReturnRequest
    // POST /api/chatbot/tools/orders/{orderNumber}/return
    // Body: { "email": "customer@example.com", "reason": "Item damaged" }
    // -----------------------------------------------------------------------

    @PostMapping("/orders/{orderNumber}/return")
    public ResponseEntity<?> createReturnRequest(
            @PathVariable String orderNumber,
            @RequestBody Map<String, String> body
    ) {
        String email = body == null ? null : body.get("email");
        String reason = body == null ? null : body.get("reason");

        if (!StringUtils.hasText(orderNumber)) {
            return badRequest("orderNumber is required");
        }
        if (!StringUtils.hasText(email) || !isValidEmail(email)) {
            return badRequest("email is required for ownership verification");
        }
        if (!StringUtils.hasText(reason) || reason.trim().length() < 5) {
            return badRequest("reason must be at least 5 characters");
        }
        if (reason.trim().length() > 2000) {
            return badRequest("reason must not exceed 2000 characters");
        }

        try {
            // Verify order ownership before creating return request
            User syntheticUser = syntheticUser(email);
            Optional<com.example.shop.modules.order.dto.OrderTrackingDto> order =
                    orderService.getOrderTrackingByNumberForCustomer(orderNumber.trim().toUpperCase(), syntheticUser);

            if (order.isEmpty()) {
                return ResponseEntity.status(HttpStatus.NOT_FOUND)
                        .body(McpToolResponse.ToolError.builder()
                                .success(false)
                                .errorCode("ORDER_NOT_FOUND")
                                .message("Order " + orderNumber + " not found for this customer")
                                .build());
            }

            // Check if there's already a pending return for this order
            List<ChatbotReturnRequest> existing = returnRequestRepository
                    .findByOrderNumberIgnoreCaseAndCustomerEmailIgnoreCase(
                            orderNumber.trim().toUpperCase(), email.trim().toLowerCase());

            if (existing.stream().anyMatch(r -> "PENDING".equals(r.getStatus()))) {
                return ResponseEntity.status(HttpStatus.CONFLICT)
                        .body(McpToolResponse.ReturnRequestResult.builder()
                                .success(false)
                                .orderNumber(orderNumber.toUpperCase())
                                .status("PENDING")
                                .message("A return request for this order is already pending review")
                                .build());
            }

            ChatbotReturnRequest returnRequest = returnRequestRepository.save(
                    ChatbotReturnRequest.builder()
                            .orderNumber(orderNumber.trim().toUpperCase())
                            .customerEmail(email.trim().toLowerCase())
                            .reason(reason.trim())
                            .status("PENDING")
                            .build());

            log.info("mcp_tool=createReturnRequest orderNumber={} requestId={}", orderNumber, returnRequest.getId());
            return ResponseEntity.status(HttpStatus.CREATED)
                    .body(McpToolResponse.ReturnRequestResult.builder()
                            .success(true)
                            .requestId(returnRequest.getId())
                            .orderNumber(orderNumber.toUpperCase())
                            .status("PENDING")
                            .message("Return request submitted. Our team will review it within 1-2 business days.")
                            .build());
        } catch (Exception e) {
            log.error("mcp_tool=createReturnRequest error={}", e.getMessage());
            return toolError("RETURN_REQUEST_ERROR", e.getMessage());
        }
    }

    // -----------------------------------------------------------------------
    // Helpers
    // -----------------------------------------------------------------------

    private User syntheticUser(String email) {
        User user = new User();
        user.setEmail(email.trim().toLowerCase());
        return user;
    }

    private boolean isValidEmail(String email) {
        return email != null && email.matches("^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$");
    }

    private ResponseEntity<?> badRequest(String message) {
        return ResponseEntity.badRequest()
                .body(McpToolResponse.ToolError.builder()
                        .success(false)
                        .errorCode("INVALID_INPUT")
                        .message(message)
                        .build());
    }

    private ResponseEntity<?> toolError(String code, String detail) {
        return ResponseEntity.internalServerError()
                .body(McpToolResponse.ToolError.builder()
                        .success(false)
                        .errorCode(code)
                        .message(detail != null ? detail : "An internal error occurred")
                        .build());
    }
}
