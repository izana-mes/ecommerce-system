package com.example.shop.modules.seller.inventory.service;

import com.example.shop.common.exception.BusinessException;
import com.example.shop.modules.product.entity.Product;
import com.example.shop.modules.product.repository.ProductRepository;
import com.example.shop.modules.seller.inventory.dto.BulkStockUpdateRequest;
import com.example.shop.modules.seller.inventory.dto.InventoryItemDto;
import com.example.shop.modules.seller.inventory.dto.StockUpdateRequest;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class SellerInventoryServiceImpl implements SellerInventoryService {

    private final ProductRepository productRepository;
    private final com.example.shop.modules.inventory.repository.InventoryRepository inventoryRepository;

    @Override
    @Transactional(readOnly = true)
    public List<InventoryItemDto> getInventory(UUID sellerUserId, int lowStockThreshold) {
        int safeThreshold = Math.max(1, lowStockThreshold);
        return productRepository.findBySellerUserIdOrderByIdAsc(sellerUserId)
                .stream()
                .map(p -> toDto(p, safeThreshold))
                .toList();
    }

    @Override
    @Transactional
    public InventoryItemDto updateStock(UUID sellerUserId, StockUpdateRequest request) {
        Product product = productRepository.findByProductID(request.getProductId())
                .orElseThrow(() -> new BusinessException(
                        "Product not found: " + request.getProductId(), HttpStatus.NOT_FOUND));

        if (!sellerUserId.equals(product.getSellerUserId())) {
            throw new BusinessException("You do not own this product", HttpStatus.FORBIDDEN);
        }

        product.setStockQuantity(request.getNewQuantity());
        productRepository.save(product);

        // Sync inventory.available_stock when seller updates product stock
        try {
            inventoryRepository.findByProductId(product.getProductID()).ifPresent(inv -> {
                int totalOtherOnHands = nz(inv.getReservedStock()) + nz(inv.getPackedStock()) + nz(inv.getInTransitStock()) + nz(inv.getReturnedStock()) + nz(inv.getDamagedStock());
                int desiredAvailable = Math.max(0, (product.getStockQuantity() == null ? 25 : Math.max(0, product.getStockQuantity())) - totalOtherOnHands);
                inv.setAvailableStock(desiredAvailable);
                inv.setUpdatedAt(java.time.LocalDateTime.now());
                inventoryRepository.save(inv);
            });
        } catch (Exception ex) {
            log.warn("Failed to sync inventory for product {}: {}", request.getProductId(), ex.getMessage());
        }

        int threshold = request.getLowStockThreshold() != null ? request.getLowStockThreshold() : 5;
        log.info("Seller {} updated stock for product {} to {}",
                sellerUserId, request.getProductId(), request.getNewQuantity());

        return toDto(product, threshold);
    }

    private int nz(Integer v) { return v == null ? 0 : v; }

    /**
     * Uses a DB-level filter ({@link ProductRepository#findLowStockBySeller}) instead of
     * loading all products and filtering in-memory — avoids a full-scan for large catalogs.
     */
    @Override
    @Transactional(readOnly = true)
    public List<InventoryItemDto> getLowStockAlerts(UUID sellerUserId, int threshold) {
        int safeThreshold = Math.max(1, threshold);
        return productRepository.findLowStockBySeller(sellerUserId, safeThreshold)
                .stream()
                .map(p -> toDto(p, safeThreshold))
                .toList();
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private InventoryItemDto toDto(Product product, int lowStockThreshold) {
        int stock = stockOf(product);
        return InventoryItemDto.builder()
                .productId(product.getProductID())
                .productName(product.getProductName())
                .stockQuantity(stock)
                .lowStockThreshold(lowStockThreshold)
                .lowStock(stock <= lowStockThreshold)
                .active(Boolean.TRUE.equals(product.getActive()))
                .build();
    }

    private int stockOf(Product product) {
        return product.getStockQuantity() == null ? 0 : product.getStockQuantity();
    }

    @Override
    @Transactional
    public List<InventoryItemDto> bulkUpdateStock(UUID sellerUserId, BulkStockUpdateRequest bulkRequest) {
        return bulkRequest.getUpdates().stream()
                .map(req -> updateStock(sellerUserId, req))
                .toList();
    }
}
