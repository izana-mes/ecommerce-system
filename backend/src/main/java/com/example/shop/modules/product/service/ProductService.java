package com.example.shop.modules.product.service;

import com.example.shop.modules.product.dto.ProductDto;
import com.example.shop.modules.product.dto.StockAdjustmentItemDto;

import java.util.List;
import java.util.Map;
import java.util.UUID;

public interface ProductService {

    List<ProductDto> getAllProducts();

    List<ProductDto> searchProducts(String keyword);

    List<String> searchSuggestions(String keyword, int limit);

    ProductDto createProduct(ProductDto productDto);

    List<ProductDto> saveAllProducts(List<ProductDto> products);

    ProductDto updateProduct(String productID, ProductDto productDto);

    void deleteProduct(String productID);

    Map<String, Object> getInventoryHealth(int lowStockThreshold);

    void validateAndReserveStock(List<StockAdjustmentItemDto> items);

    void releaseStock(List<StockAdjustmentItemDto> items);

    List<ProductDto> listProductsOwnedBySupplier(UUID supplierUserId);

    List<ProductDto> listProductsOwnedBySeller(UUID sellerUserId);

    /**
     * After admin approval of a supplier-originated product create, attaches catalog ownership for supplier APIs.
     */
    void assignSupplierToProduct(String productId, UUID supplierUserId);

    /**
     * After admin approval of a seller-originated product create, attaches catalog ownership for seller APIs.
     */
    void assignSellerToProduct(String productId, UUID sellerUserId);
}
