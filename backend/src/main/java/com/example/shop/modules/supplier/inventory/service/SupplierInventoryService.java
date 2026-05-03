package com.example.shop.modules.supplier.inventory.service;

import com.example.shop.modules.supplier.inventory.dto.InventoryItemDto;
import com.example.shop.modules.supplier.inventory.dto.StockUpdateRequest;

import java.util.List;
import java.util.UUID;

public interface SupplierInventoryService {

    List<InventoryItemDto> getInventory(UUID supplierUserId, int lowStockThreshold);

    InventoryItemDto updateStock(UUID supplierUserId, StockUpdateRequest request);

    List<InventoryItemDto> getLowStockAlerts(UUID supplierUserId, int threshold);
}
