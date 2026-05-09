package com.example.shop.modules.supplier.inventory.service;

import com.example.shop.common.exception.BusinessException;
import com.example.shop.modules.product.entity.Product;
import com.example.shop.modules.product.repository.ProductRepository;
import com.example.shop.modules.supplier.inventory.dto.InventoryItemDto;
import com.example.shop.modules.supplier.inventory.dto.StockUpdateRequest;
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
public class SupplierInventoryServiceImpl implements SupplierInventoryService {

    private final ProductRepository productRepository;

    @Override
    @Transactional(readOnly = true)
    public List<InventoryItemDto> getInventory(UUID supplierUserId, int lowStockThreshold) {
        int safeThreshold = Math.max(1, lowStockThreshold);
        return productRepository.findBySupplierUserIdOrderByIdAsc(supplierUserId)
                .stream()
                .map(p -> toDto(p, safeThreshold))
                .toList();
    }

    @Override
    @Transactional
    public InventoryItemDto updateStock(UUID supplierUserId, StockUpdateRequest request) {
        Product product = productRepository.findByProductID(request.getProductId())
                .orElseThrow(() -> new BusinessException(
                        "Product not found: " + request.getProductId(), HttpStatus.NOT_FOUND));

        if (!supplierUserId.equals(product.getSupplierUserId())) {
            throw new BusinessException("You do not own this product", HttpStatus.FORBIDDEN);
        }

        product.setStockQuantity(request.getNewQuantity());
        productRepository.save(product);

        int threshold = request.getLowStockThreshold() != null ? request.getLowStockThreshold() : 5;
        log.info("Supplier {} updated stock for product {} to {}",
                supplierUserId, request.getProductId(), request.getNewQuantity());

        return toDto(product, threshold);
    }

    @Override
    @Transactional(readOnly = true)
    public List<InventoryItemDto> getLowStockAlerts(UUID supplierUserId, int threshold) {
        int safeThreshold = Math.max(1, threshold);
        return productRepository.findLowStockBySupplier(supplierUserId, safeThreshold)
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
}
