package com.example.shop.modules.seller.inventory.service;

import com.example.shop.modules.seller.inventory.dto.BulkStockUpdateRequest;
import com.example.shop.modules.seller.inventory.dto.InventoryItemDto;
import com.example.shop.modules.seller.inventory.dto.StockUpdateRequest;

import java.util.List;
import java.util.UUID;

public interface SellerInventoryService {

    List<InventoryItemDto> getInventory(UUID sellerUserId, int lowStockThreshold);

    InventoryItemDto updateStock(UUID sellerUserId, StockUpdateRequest request);

    List<InventoryItemDto> getLowStockAlerts(UUID sellerUserId, int threshold);

    /** Update stock for multiple products in a single call. */
    List<InventoryItemDto> bulkUpdateStock(UUID sellerUserId, BulkStockUpdateRequest request);
}

