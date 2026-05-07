package com.example.shop.modules.seller.inventory.controller;

import com.example.shop.common.response.ApiResponse;
import com.example.shop.modules.seller.inventory.dto.InventoryItemDto;
import com.example.shop.modules.seller.inventory.dto.StockUpdateRequest;
import com.example.shop.modules.seller.inventory.service.SellerInventoryService;
import com.example.shop.modules.user.entity.User;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/seller/inventory")
@RequiredArgsConstructor
public class SellerInventoryController {

    private final SellerInventoryService inventoryService;

    /**
     * GET /api/v1/seller/inventory?lowStockThreshold=5
     *
     * Returns all products owned by the authenticated seller with their stock info.
     *
     * Example response:
     * {
     *   "success": true,
     *   "data": [
     *     { "productId": "P001", "productName": "Widget", "stockQuantity": 3, "lowStockThreshold": 5, "lowStock": true, "active": true },
     *     { "productId": "P002", "productName": "Gadget", "stockQuantity": 40, "lowStockThreshold": 5, "lowStock": false, "active": true }
     *   ]
     * }
     */
    @GetMapping
    @PreAuthorize("hasRole('SELLER')")
    public ResponseEntity<ApiResponse<List<InventoryItemDto>>> getInventory(
            @AuthenticationPrincipal User user,
            @RequestParam(defaultValue = "5") int lowStockThreshold
    ) {
        List<InventoryItemDto> items = inventoryService.getInventory(user.getId(), lowStockThreshold);
        return ResponseEntity.ok(ApiResponse.success(items));
    }

    /**
     * PUT /api/v1/seller/inventory/{productId}/stock
     *
     * Updates stock quantity for one of the seller's products.
     *
     * Request body:
     * { "productId": "P001", "newQuantity": 50, "lowStockThreshold": 5 }
     *
     * Example response: single updated InventoryItemDto
     */
    @PutMapping("/{productId}/stock")
    @PreAuthorize("hasRole('SELLER')")
    public ResponseEntity<ApiResponse<InventoryItemDto>> updateStock(
            @AuthenticationPrincipal User user,
            @PathVariable String productId,
            @Valid @RequestBody StockUpdateRequest request
    ) {
        // Ensure path variable is consistent with body
        request.setProductId(productId);
        InventoryItemDto updated = inventoryService.updateStock(user.getId(), request);
        return ResponseEntity.ok(ApiResponse.success(updated, "Stock updated successfully"));
    }

    /**
     * GET /api/v1/seller/inventory/low-stock?threshold=5
     *
     * Returns only products whose stock is at or below the threshold.
     *
     * Example response:
     * {
     *   "success": true,
     *   "data": [
     *     { "productId": "P001", "productName": "Widget", "stockQuantity": 3, "lowStockThreshold": 5, "lowStock": true, "active": true }
     *   ]
     * }
     */
    @GetMapping("/low-stock")
    @PreAuthorize("hasRole('SELLER')")
    public ResponseEntity<ApiResponse<List<InventoryItemDto>>> getLowStock(
            @AuthenticationPrincipal User user,
            @RequestParam(defaultValue = "5") int threshold
    ) {
        List<InventoryItemDto> alerts = inventoryService.getLowStockAlerts(user.getId(), threshold);
        return ResponseEntity.ok(ApiResponse.success(alerts));
    }
}

