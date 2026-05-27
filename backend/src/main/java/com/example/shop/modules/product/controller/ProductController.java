package com.example.shop.modules.product.controller;

import com.example.shop.common.audit.AdminAuditLogger;
import com.example.shop.common.exception.UnauthorizedException;
import com.example.shop.modules.product.dto.ProductDto;
import com.example.shop.modules.product.dto.StockAdjustmentRequestDto;
import com.example.shop.modules.product.service.ProductService;
import com.example.shop.modules.product.service.ProductTrendingService;
import com.example.shop.modules.product.service.RecentlyViewedProductService;
import com.example.shop.modules.productapproval.dto.ProductChangeRequestResponseDto;
import com.example.shop.modules.productapproval.dto.request.ReviewProductChangeRequestDto;
import com.example.shop.modules.productapproval.service.ProductChangeRequestService;
import com.example.shop.modules.searchhistory.service.SearchHistoryService;
import com.example.shop.modules.user.entity.User;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.util.StringUtils;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/products")
@RequiredArgsConstructor
public class ProductController {

    private final ProductService productService;
    private final ProductTrendingService productTrendingService;
    private final RecentlyViewedProductService recentlyViewedProductService;
    private final SearchHistoryService searchHistoryService;
    private final AdminAuditLogger adminAuditLogger;
    private final ProductChangeRequestService productChangeRequestService;
    @Value("${application.internal.notify-token:}")
    private String internalNotifyToken;

    @GetMapping
    public ResponseEntity<List<ProductDto>> getProducts(
            @RequestParam(value = "q", required = false) String query,
            @AuthenticationPrincipal User user) {
        if (query == null || query.isBlank()) {
            return ResponseEntity.ok(productService.getAllProducts());
        }
        searchHistoryService.saveSearchTerm(user, query);
        return ResponseEntity.ok(productService.searchProducts(query));
    }

    @GetMapping("/search-history")
    @PreAuthorize("!isAnonymous()")
    public ResponseEntity<List<String>> getSearchHistory(
            @RequestParam(value = "limit", required = false, defaultValue = "10") int limit,
            @AuthenticationPrincipal User user) {
        return ResponseEntity.ok(searchHistoryService.getHistory(user, limit));
    }

    @GetMapping("/suggest")
    public ResponseEntity<List<String>> getSearchSuggestions(
            @RequestParam(value = "q", required = false) String query,
            @RequestParam(value = "limit", required = false, defaultValue = "8") int limit
    ) {
        return ResponseEntity.ok(productService.searchSuggestions(query, limit));
    }

    @PostMapping("/{productID}/view")
    public ResponseEntity<Void> trackProductView(
            @PathVariable("productID") String productID,
            @AuthenticationPrincipal User user
    ) {
        productTrendingService.trackProductView(productID);
        recentlyViewedProductService.track(user, productID);
        return ResponseEntity.accepted().build();
    }

    @GetMapping("/trending")
    public ResponseEntity<List<ProductDto>> getTrendingProducts(
            @RequestParam(value = "limit", required = false, defaultValue = "12") int limit
    ) {
        return ResponseEntity.ok(productTrendingService.getTrendingProducts(limit));
    }

    @GetMapping("/recently-viewed")
    @PreAuthorize("!isAnonymous()")
    public ResponseEntity<List<ProductDto>> getRecentlyViewed(
            @AuthenticationPrincipal User user,
            @RequestParam(value = "limit", required = false, defaultValue = "10") int limit
    ) {
        return ResponseEntity.ok(recentlyViewedProductService.getRecentlyViewed(user, limit));
    }

    @DeleteMapping("/recently-viewed")
    @PreAuthorize("!isAnonymous()")
    public ResponseEntity<Void> clearRecentlyViewed(@AuthenticationPrincipal User user) {
        recentlyViewedProductService.clear(user);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/supplier/mine")
    @PreAuthorize("hasRole('SUPPLIER')")
    public ResponseEntity<List<ProductDto>> listSupplierOwnedProducts(@AuthenticationPrincipal User actor) {
        return ResponseEntity.ok(productService.listProductsOwnedBySupplier(actor.getId()));
    }

    @GetMapping("/seller/mine")
    @PreAuthorize("hasRole('SELLER')")
    public ResponseEntity<List<ProductDto>> listSellerOwnedProducts(@AuthenticationPrincipal User actor) {
        return ResponseEntity.ok(productService.listProductsOwnedBySeller(actor.getId()));
    }

    @DeleteMapping("/search-history")
    @PreAuthorize("!isAnonymous()")
    public ResponseEntity<Void> clearSearchHistory(@AuthenticationPrincipal User user) {
        searchHistoryService.clearHistory(user);
        return ResponseEntity.noContent().build();
    }

    @PostMapping
    @PreAuthorize("hasAnyRole('ADMIN', 'EMPLOYEE', 'SUPPLIER', 'SELLER')")
    public ResponseEntity<?> addProducts(
            @RequestBody List<ProductDto> products,
            @AuthenticationPrincipal User actor
    ) {
        if (hasRole(actor, "ROLE_EMPLOYEE") || hasRole(actor, "ROLE_SUPPLIER") || hasRole(actor, "ROLE_SELLER")) {
            ProductChangeRequestResponseDto request = productChangeRequestService.requestBulkUpsert(products, actor);
            return ResponseEntity.accepted().body(Map.of(
                    "message", "Bulk product change request submitted for admin approval",
                    "request", request
            ));
        }
        List<ProductDto> saved = productService.saveAllProducts(products);
        adminAuditLogger.log(
                "PRODUCT_BULK_UPSERT",
                actorEmail(actor),
                Map.of("inputCount", products == null ? 0 : products.size(), "savedCount", saved.size())
        );
        return ResponseEntity.ok(saved);
    }

    @GetMapping("/inventory-health")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Map<String, Object>> getInventoryHealth(
            @RequestParam(value = "lowStockThreshold", required = false, defaultValue = "5") int lowStockThreshold
    ) {
        return ResponseEntity.ok(productService.getInventoryHealth(lowStockThreshold));
    }

    @PostMapping("/stock/validate-reserve")
    public ResponseEntity<Map<String, Object>> validateAndReserveStock(
            @RequestHeader(value = "X-Internal-Token", required = false) String token,
            @RequestBody StockAdjustmentRequestDto request
    ) {
        requireInternalToken(token);
        productService.validateAndReserveStock(request.getItems());
        return ResponseEntity.ok(Map.of("success", true));
    }

    @PostMapping("/stock/release")
    public ResponseEntity<Map<String, Object>> releaseStock(
            @RequestHeader(value = "X-Internal-Token", required = false) String token,
            @RequestBody StockAdjustmentRequestDto request
    ) {
        requireInternalToken(token);
        productService.releaseStock(request.getItems());
        return ResponseEntity.ok(Map.of("success", true));
    }

    @PostMapping("/single")
    @PreAuthorize("hasAnyRole('ADMIN', 'EMPLOYEE', 'SUPPLIER', 'SELLER')")
    public ResponseEntity<?> addProduct(
            @RequestBody ProductDto product,
            @AuthenticationPrincipal User actor
    ) {
        if (hasRole(actor, "ROLE_EMPLOYEE") || hasRole(actor, "ROLE_SUPPLIER") || hasRole(actor, "ROLE_SELLER")) {
            ProductChangeRequestResponseDto request = productChangeRequestService.requestCreate(product, actor);
            return ResponseEntity.accepted().body(Map.of(
                    "message", "Product create request submitted for admin approval",
                    "request", request
            ));
        }
        ProductDto created = productService.createProduct(product);
        adminAuditLogger.log(
                "PRODUCT_CREATE",
                actorEmail(actor),
                Map.of("productID", created.getProductID())
        );
        return ResponseEntity.ok(created);
    }

    @PutMapping("/{productID}")
    @PreAuthorize("hasAnyRole('ADMIN', 'EMPLOYEE', 'SUPPLIER', 'SELLER')")
    public ResponseEntity<?> updateProduct(
            @PathVariable("productID") String productID,
            @RequestBody ProductDto product,
            @AuthenticationPrincipal User actor
    ) {
        if (hasRole(actor, "ROLE_EMPLOYEE") || hasRole(actor, "ROLE_SUPPLIER") || hasRole(actor, "ROLE_SELLER")) {
            ProductChangeRequestResponseDto request = productChangeRequestService.requestUpdate(productID, product, actor);
            return ResponseEntity.accepted().body(Map.of(
                    "message", "Product update request submitted for admin approval",
                    "request", request
            ));
        }
        ProductDto updated = productService.updateProduct(productID, product);
        adminAuditLogger.log(
                "PRODUCT_UPDATE",
                actorEmail(actor),
                Map.of("productID", productID)
        );
        return ResponseEntity.ok(updated);
    }

    @DeleteMapping("/{productID}")
    @PreAuthorize("hasAnyRole('ADMIN', 'EMPLOYEE', 'SUPPLIER', 'SELLER')")
    public ResponseEntity<?> deleteProduct(
            @PathVariable("productID") String productID,
            @AuthenticationPrincipal User actor
    ) {
        if (hasRole(actor, "ROLE_EMPLOYEE") || hasRole(actor, "ROLE_SUPPLIER") || hasRole(actor, "ROLE_SELLER")) {
            ProductChangeRequestResponseDto request = productChangeRequestService.requestDelete(productID, actor);
            return ResponseEntity.accepted().body(Map.of(
                    "message", "Product delete request submitted for admin approval",
                    "request", request
            ));
        }
        productService.deleteProduct(productID);
        adminAuditLogger.log(
                "PRODUCT_DELETE",
                actorEmail(actor),
                Map.of("productID", productID)
        );
        return ResponseEntity.ok().build();
    }

    @GetMapping("/change-requests")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<List<ProductChangeRequestResponseDto>> listChangeRequests(
            @RequestParam(value = "status", required = false) String status
    ) {
        return ResponseEntity.ok(productChangeRequestService.listRequests(status));
    }

    @GetMapping("/change-requests/mine")
    @PreAuthorize("hasAnyRole('ADMIN', 'EMPLOYEE', 'SUPPLIER', 'SELLER')")
    public ResponseEntity<List<ProductChangeRequestResponseDto>> listMyChangeRequests(
            @AuthenticationPrincipal User actor
    ) {
        return ResponseEntity.ok(productChangeRequestService.listRequestsForRequester(actor));
    }

    @PostMapping("/change-requests/{requestId}/approve")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ProductChangeRequestResponseDto> approveChangeRequest(
            @PathVariable("requestId") UUID requestId,
            @RequestBody(required = false) ReviewProductChangeRequestDto request,
            @AuthenticationPrincipal User actor
    ) {
        String note = request == null ? null : request.getNote();
        return ResponseEntity.ok(productChangeRequestService.approve(requestId, actor, note));
    }

    @PostMapping("/change-requests/{requestId}/reject")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ProductChangeRequestResponseDto> rejectChangeRequest(
            @PathVariable("requestId") UUID requestId,
            @RequestBody(required = false) ReviewProductChangeRequestDto request,
            @AuthenticationPrincipal User actor
    ) {
        String note = request == null ? null : request.getNote();
        return ResponseEntity.ok(productChangeRequestService.reject(requestId, actor, note));
    }

    private void requireInternalToken(String token) {
        String configuredToken = internalNotifyToken == null ? "" : internalNotifyToken.trim();
        String receivedToken = token == null ? "" : token.trim();
        if (!StringUtils.hasText(configuredToken)) {
            throw new IllegalStateException("Internal notify token is not configured");
        }
        if (!configuredToken.equals(receivedToken)) {
            throw new UnauthorizedException("Unauthorized");
        }
    }

    private String actorEmail(User actor) {
        return actor == null ? "unknown" : String.valueOf(actor.getEmail());
    }

    private boolean hasRole(User actor, String roleName) {
        if (actor == null || actor.getRoles() == null) {
            return false;
        }
        return actor.getRoles().stream().anyMatch(role -> roleName.equalsIgnoreCase(role.getName()));
    }
}
