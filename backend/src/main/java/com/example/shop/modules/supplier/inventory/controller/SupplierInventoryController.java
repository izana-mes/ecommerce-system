package com.example.shop.modules.supplier.inventory.controller;

import com.example.shop.common.response.ApiResponse;
import com.example.shop.modules.supplier.inventory.dto.InventoryItemDto;
import com.example.shop.modules.supplier.inventory.dto.RestockRequestDto;
import com.example.shop.modules.supplier.inventory.dto.RestockRequestResponseDto;
import com.example.shop.modules.supplier.inventory.dto.StockUpdateRequest;
import com.example.shop.modules.supplier.inventory.service.SupplierInventoryService;
import com.example.shop.modules.user.entity.User;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/supplier/inventory")
@RequiredArgsConstructor
public class SupplierInventoryController {

    private final SupplierInventoryService inventoryService;

    /**
     * GET /api/v1/supplier/inventory?lowStockThreshold=5
     *
     * Returns all products owned by the authenticated supplier with their stock info.
     */
    @GetMapping
    @PreAuthorize("hasRole('SUPPLIER')")
    public ResponseEntity<ApiResponse<List<InventoryItemDto>>> getInventory(
            @AuthenticationPrincipal User user,
            @RequestParam(defaultValue = "5") int lowStockThreshold
    ) {
        List<InventoryItemDto> items = inventoryService.getInventory(user.getId(), lowStockThreshold);
        return ResponseEntity.ok(ApiResponse.success(items));
    }

    /**
     * PUT /api/v1/supplier/inventory/{productId}/stock
     *
     * Updates stock quantity for one of the supplier's products.
     */
    @PutMapping("/{productId}/stock")
    @PreAuthorize("hasRole('SUPPLIER')")
    public ResponseEntity<ApiResponse<InventoryItemDto>> updateStock(
            @AuthenticationPrincipal User user,
            @PathVariable String productId,
            @Valid @RequestBody StockUpdateRequest request
    ) {
        request.setProductId(productId);
        InventoryItemDto updated = inventoryService.updateStock(user.getId(), request);
        return ResponseEntity.ok(ApiResponse.success(updated, "Stock updated successfully"));
    }

    /**
     * GET /api/v1/supplier/inventory/low-stock?threshold=5
     *
     * Returns only products whose stock is at or below the threshold.
     */
    @GetMapping("/low-stock")
    @PreAuthorize("hasRole('SUPPLIER')")
    public ResponseEntity<ApiResponse<List<InventoryItemDto>>> getLowStock(
            @AuthenticationPrincipal User user,
            @RequestParam(defaultValue = "5") int threshold
    ) {
        List<InventoryItemDto> alerts = inventoryService.getLowStockAlerts(user.getId(), threshold);
        return ResponseEntity.ok(ApiResponse.success(alerts));
    }

    /**
     * POST /api/v1/supplier/inventory/restock-request
     *
     * Submits a formal restock request for a supplier-owned product.
     *
     * Request body:
     * {
     *   "productId": "P001",
     *   "requestedQuantity": 200,
     *   "note": "Running critically low, Black Friday approaching"
     * }
     *
     * Example response:
     * {
     *   "success": true,
     *   "message": "Restock request submitted for admin review. Current stock: 3",
     *   "data": {
     *     "productId": "P001",
     *     "productName": "Widget",
     *     "currentStock": 3,
     *     "requestedQuantity": 200,
     *     "note": "Running critically low...",
     *     "status": "SUBMITTED"
     *   }
     * }
     */
    @PostMapping("/restock-request")
    @PreAuthorize("hasRole('SUPPLIER')")
    public ResponseEntity<ApiResponse<RestockRequestResponseDto>> submitRestockRequest(
            @AuthenticationPrincipal User user,
            @Valid @RequestBody RestockRequestDto request
    ) {
        RestockRequestResponseDto response = inventoryService.submitRestockRequest(user.getId(), request);
        return ResponseEntity.ok(ApiResponse.success(response, response.getMessage()));
    }
}
