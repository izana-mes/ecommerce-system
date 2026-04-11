package com.example.shop.modules.product.controller;

import com.example.shop.common.audit.AdminAuditLogger;
import com.example.shop.common.exception.UnauthorizedException;
import com.example.shop.modules.product.dto.ProductDto;
import com.example.shop.modules.product.dto.StockAdjustmentRequestDto;
import com.example.shop.modules.product.service.ProductService;
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

@RestController
@RequestMapping("/api/products")
@RequiredArgsConstructor
public class ProductController {

    private final ProductService productService;
    private final SearchHistoryService searchHistoryService;
    private final AdminAuditLogger adminAuditLogger;
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
    @PreAuthorize("isFullyAuthenticated()")
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

    @DeleteMapping("/search-history")
    @PreAuthorize("isFullyAuthenticated()")
    public ResponseEntity<Void> clearSearchHistory(@AuthenticationPrincipal User user) {
        searchHistoryService.clearHistory(user);
        return ResponseEntity.noContent().build();
    }

    @PostMapping
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<List<ProductDto>> addProducts(
            @RequestBody List<ProductDto> products,
            @AuthenticationPrincipal User actor
    ) {
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
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ProductDto> addProduct(
            @RequestBody ProductDto product,
            @AuthenticationPrincipal User actor
    ) {
        ProductDto created = productService.createProduct(product);
        adminAuditLogger.log(
                "PRODUCT_CREATE",
                actorEmail(actor),
                Map.of("productID", created.getProductID())
        );
        return ResponseEntity.ok(created);
    }

    @PutMapping("/{productID}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ProductDto> updateProduct(
            @PathVariable("productID") String productID,
            @RequestBody ProductDto product,
            @AuthenticationPrincipal User actor
    ) {
        ProductDto updated = productService.updateProduct(productID, product);
        adminAuditLogger.log(
                "PRODUCT_UPDATE",
                actorEmail(actor),
                Map.of("productID", productID)
        );
        return ResponseEntity.ok(updated);
    }

    @DeleteMapping("/{productID}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Void> deleteProduct(
            @PathVariable("productID") String productID,
            @AuthenticationPrincipal User actor
    ) {
        productService.deleteProduct(productID);
        adminAuditLogger.log(
                "PRODUCT_DELETE",
                actorEmail(actor),
                Map.of("productID", productID)
        );
        return ResponseEntity.ok().build();
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
}
