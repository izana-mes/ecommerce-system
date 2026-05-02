package com.example.shop.modules.product.service;

import com.example.shop.common.exception.BusinessException;
import com.example.shop.config.RedisCacheConfig;
import com.example.shop.modules.cart.repository.CartItemRepository;
import com.example.shop.modules.cart.repository.CartReservedStockProjection;
import com.example.shop.modules.product.dto.ProductDto;
import com.example.shop.modules.product.dto.StockAdjustmentItemDto;
import com.example.shop.modules.product.entity.Product;
import com.example.shop.modules.product.mapper.ProductMapper;
import com.example.shop.modules.product.repository.ProductRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.cache.annotation.Caching;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Transactional
public class ProductServiceImpl implements ProductService {

    private static final int DEFAULT_STOCK_QUANTITY = 25;

    private final ProductRepository productRepository;
    private final ProductMapper productMapper;
    private final CartItemRepository cartItemRepository;

    @Override
    @Transactional(readOnly = true)
    @Cacheable(cacheNames = RedisCacheConfig.PRODUCTS_ALL)
    public List<ProductDto> getAllProducts() {
        return productRepository.findAllByOrderByIdAsc()
                .stream()
                .map(productMapper::toDto)
                .toList();
    }

    @Override
    @Transactional(readOnly = true)
    @Cacheable(
            cacheNames = RedisCacheConfig.PRODUCTS_SEARCH,
            key = "(#keyword == null ? '' : #keyword.trim().toLowerCase())"
    )
    public List<ProductDto> searchProducts(String keyword) {
        if (!StringUtils.hasText(keyword)) {
            return getAllProducts();
        }

        String normalized = keyword.trim();
        List<String> tokens = tokenizeKeyword(normalized);
        if (tokens.isEmpty()) {
            return getAllProducts();
        }

        return productRepository.findAllByOrderByIdAsc()
                .stream()
                .filter(product -> matchesAllTokens(product, tokens))
                .map(productMapper::toDto)
                .toList();
    }

    @Override
    @Transactional(readOnly = true)
    @Cacheable(
            cacheNames = RedisCacheConfig.PRODUCTS_SUGGEST,
            key = "(#keyword == null ? '' : #keyword.trim().toLowerCase()) + '::' + T(java.lang.Math).max(1, T(java.lang.Math).min(#limit, 15))"
    )
    public List<String> searchSuggestions(String keyword, int limit) {
        if (!StringUtils.hasText(keyword)) {
            return List.of();
        }

        String normalized = keyword.trim();
        int normalizedLimit = Math.max(1, Math.min(limit, 15));
        List<String> tokens = tokenizeKeyword(normalized);
        if (tokens.isEmpty()) {
            return List.of();
        }

        List<Product> matchedProducts = productRepository.findAllByOrderByIdAsc()
                .stream()
                .filter(product -> matchesAllTokens(product, tokens))
                .toList();

        String loweredKeyword = normalized.toLowerCase();
        Comparator<String> suggestionComparator = Comparator
                .comparingInt((String value) -> scoreSuggestion(value, loweredKeyword))
                .thenComparing(String::length)
                .thenComparing(String.CASE_INSENSITIVE_ORDER);

        Map<String, String> uniqueSuggestions = new LinkedHashMap<>();
        for (Product product : matchedProducts) {
            addSuggestion(uniqueSuggestions, product.getProductName());
            addSuggestion(uniqueSuggestions, product.getProductID());
        }

        return uniqueSuggestions.values()
                .stream()
                .sorted(suggestionComparator)
                .limit(normalizedLimit)
                .toList();
    }

    @Override
    @Caching(evict = {
            @CacheEvict(cacheNames = RedisCacheConfig.PRODUCTS_ALL, allEntries = true),
            @CacheEvict(cacheNames = RedisCacheConfig.PRODUCTS_SEARCH, allEntries = true),
            @CacheEvict(cacheNames = RedisCacheConfig.PRODUCTS_SUGGEST, allEntries = true),
            @CacheEvict(cacheNames = RedisCacheConfig.PRODUCTS_INVENTORY_HEALTH, allEntries = true),
            @CacheEvict(cacheNames = RedisCacheConfig.ADMIN_DASHBOARD, allEntries = true)
    })
    public ProductDto createProduct(ProductDto productDto) {
        if (!StringUtils.hasText(productDto.getProductID())) {
            throw new IllegalArgumentException("productID is required");
        }

        if (productRepository.findByProductID(productDto.getProductID()).isPresent()) {
            throw new IllegalArgumentException("Product already exists: " + productDto.getProductID());
        }

        Product entity = productMapper.toEntity(productDto);
        applyInventoryDefaults(entity, productDto);
        if (productDto.getSupplierUserId() != null) {
            entity.setSupplierUserId(productDto.getSupplierUserId());
        }
        Product saved = productRepository.save(entity);
        return productMapper.toDto(saved);
    }

    @Override
    @Caching(evict = {
            @CacheEvict(cacheNames = RedisCacheConfig.PRODUCTS_ALL, allEntries = true),
            @CacheEvict(cacheNames = RedisCacheConfig.PRODUCTS_SEARCH, allEntries = true),
            @CacheEvict(cacheNames = RedisCacheConfig.PRODUCTS_SUGGEST, allEntries = true),
            @CacheEvict(cacheNames = RedisCacheConfig.PRODUCTS_INVENTORY_HEALTH, allEntries = true),
            @CacheEvict(cacheNames = RedisCacheConfig.ADMIN_DASHBOARD, allEntries = true)
    })
    public List<ProductDto> saveAllProducts(List<ProductDto> products) {
        List<Product> entities = products.stream()
                .map(dto -> productRepository.findByProductID(dto.getProductID())
                        .map(existing -> {
                            existing.setFrontImg(dto.getFrontImg());
                            existing.setBackImg(dto.getBackImg());
                            existing.setProductName(dto.getProductName());
                            existing.setProductPrice(dto.getProductPrice());
                            existing.setProductReviews(dto.getProductReviews());
                            existing.setSizes(productMapper.map(dto.getSizes()));
                            applyInventoryDefaults(existing, dto);
                            return existing;
                        })
                        .orElseGet(() -> {
                            Product entity = productMapper.toEntity(dto);
                            applyInventoryDefaults(entity, dto);
                            return entity;
                        }))
                .toList();

        return productRepository.saveAll(entities)
                .stream()
                .map(productMapper::toDto)
                .toList();
    }

    @Override
    @Caching(evict = {
            @CacheEvict(cacheNames = RedisCacheConfig.PRODUCTS_ALL, allEntries = true),
            @CacheEvict(cacheNames = RedisCacheConfig.PRODUCTS_SEARCH, allEntries = true),
            @CacheEvict(cacheNames = RedisCacheConfig.PRODUCTS_SUGGEST, allEntries = true),
            @CacheEvict(cacheNames = RedisCacheConfig.PRODUCTS_INVENTORY_HEALTH, allEntries = true),
            @CacheEvict(cacheNames = RedisCacheConfig.ADMIN_DASHBOARD, allEntries = true)
    })
    public ProductDto updateProduct(String productID, ProductDto dto) {
        Product existing = productRepository.findByProductID(productID)
                .orElseThrow(() -> new IllegalArgumentException("Product not found: " + productID));

        existing.setFrontImg(dto.getFrontImg());
        existing.setBackImg(dto.getBackImg());
        existing.setProductName(dto.getProductName());
        existing.setProductPrice(dto.getProductPrice());
        existing.setProductReviews(dto.getProductReviews());
        existing.setSizes(productMapper.map(dto.getSizes()));
        applyInventoryDefaults(existing, dto);
        if (dto.getSupplierUserId() != null) {
            existing.setSupplierUserId(dto.getSupplierUserId());
        }

        Product saved = productRepository.save(existing);
        return productMapper.toDto(saved);
    }

    @Override
    @Transactional(readOnly = true)
    public List<ProductDto> listProductsOwnedBySupplier(UUID supplierUserId) {
        if (supplierUserId == null) {
            return List.of();
        }
        return productRepository.findBySupplierUserIdOrderByIdAsc(supplierUserId)
                .stream()
                .map(productMapper::toDto)
                .toList();
    }

    @Override
    @Caching(evict = {
            @CacheEvict(cacheNames = RedisCacheConfig.PRODUCTS_ALL, allEntries = true),
            @CacheEvict(cacheNames = RedisCacheConfig.PRODUCTS_SEARCH, allEntries = true),
            @CacheEvict(cacheNames = RedisCacheConfig.PRODUCTS_SUGGEST, allEntries = true),
            @CacheEvict(cacheNames = RedisCacheConfig.PRODUCTS_INVENTORY_HEALTH, allEntries = true),
            @CacheEvict(cacheNames = RedisCacheConfig.ADMIN_DASHBOARD, allEntries = true)
    })
    public void assignSupplierToProduct(String productId, UUID supplierUserId) {
        if (!StringUtils.hasText(productId) || supplierUserId == null) {
            return;
        }
        Product existing = productRepository.findByProductID(productId)
                .orElseThrow(() -> new IllegalArgumentException("Product not found: " + productId));
        existing.setSupplierUserId(supplierUserId);
        productRepository.save(existing);
    }

    @Override
    @Caching(evict = {
            @CacheEvict(cacheNames = RedisCacheConfig.PRODUCTS_ALL, allEntries = true),
            @CacheEvict(cacheNames = RedisCacheConfig.PRODUCTS_SEARCH, allEntries = true),
            @CacheEvict(cacheNames = RedisCacheConfig.PRODUCTS_SUGGEST, allEntries = true),
            @CacheEvict(cacheNames = RedisCacheConfig.PRODUCTS_INVENTORY_HEALTH, allEntries = true),
            @CacheEvict(cacheNames = RedisCacheConfig.ADMIN_DASHBOARD, allEntries = true)
    })
    public void deleteProduct(String productID) {
        Product existing = productRepository.findByProductID(productID)
                .orElseThrow(() -> new IllegalArgumentException("Product not found: " + productID));
        productRepository.delete(existing);
    }

    @Override
    @Transactional(readOnly = true)
    @Cacheable(
            cacheNames = RedisCacheConfig.PRODUCTS_INVENTORY_HEALTH,
            key = "T(java.lang.Math).max(1, #lowStockThreshold)"
    )
    public Map<String, Object> getInventoryHealth(int lowStockThreshold) {
        int threshold = Math.max(1, lowStockThreshold);
        List<Product> products = productRepository.findAllByOrderByIdAsc();

        List<Map<String, Object>> lowStockItems = new ArrayList<>();
        List<Map<String, Object>> outOfStockItems = new ArrayList<>();
        int totalStock = 0;
        int totalReservedInCarts = 0;
        int totalAvailableToSell = 0;
        int activeProducts = 0;
        Map<String, Integer> reservedByProductId = cartItemRepository.summarizeReservedQuantities()
                .stream()
                .collect(Collectors.toMap(
                        CartReservedStockProjection::getProductID,
                        row -> row.getReservedQty() == null ? 0 : Math.max(0, row.getReservedQty().intValue())
                ));

        for (Product product : products) {
            int stock = Math.max(0, defaultStock(product.getStockQuantity()));
            int reservedInCarts = reservedByProductId.getOrDefault(product.getProductID(), 0);
            int availableToSell = Math.max(0, stock - reservedInCarts);
            boolean active = !Boolean.FALSE.equals(product.getActive());
            totalStock += stock;
            totalReservedInCarts += reservedInCarts;
            totalAvailableToSell += availableToSell;
            if (active) {
                activeProducts += 1;
            }

            Map<String, Object> item = Map.of(
                    "productID", product.getProductID(),
                    "productName", product.getProductName(),
                    "stockQuantity", stock,
                    "reservedInCarts", reservedInCarts,
                    "availableToSell", availableToSell,
                    "active", active
            );

            if (availableToSell <= 0) {
                outOfStockItems.add(item);
            } else if (availableToSell <= threshold) {
                lowStockItems.add(item);
            }
        }

        return Map.of(
                "totalProducts", products.size(),
                "activeProducts", activeProducts,
                "totalStock", totalStock,
                "totalReservedInCarts", totalReservedInCarts,
                "totalAvailableToSell", totalAvailableToSell,
                "lowStockThreshold", threshold,
                "lowStockCount", lowStockItems.size(),
                "outOfStockCount", outOfStockItems.size(),
                "lowStockItems", lowStockItems,
                "outOfStockItems", outOfStockItems
        );
    }

    @Override
    @Caching(evict = {
            @CacheEvict(cacheNames = RedisCacheConfig.PRODUCTS_ALL, allEntries = true),
            @CacheEvict(cacheNames = RedisCacheConfig.PRODUCTS_SEARCH, allEntries = true),
            @CacheEvict(cacheNames = RedisCacheConfig.PRODUCTS_SUGGEST, allEntries = true),
            @CacheEvict(cacheNames = RedisCacheConfig.PRODUCTS_INVENTORY_HEALTH, allEntries = true),
            @CacheEvict(cacheNames = RedisCacheConfig.ADMIN_DASHBOARD, allEntries = true)
    })
    public void validateAndReserveStock(List<StockAdjustmentItemDto> items) {
        Map<String, Integer> quantityByProductId = normalizeRequestItems(items);

        List<Product> products = productRepository.findByProductIDIn(new ArrayList<>(quantityByProductId.keySet()));
        Map<String, Product> productsById = products.stream()
                .collect(Collectors.toMap(Product::getProductID, Function.identity()));

        for (Map.Entry<String, Integer> entry : quantityByProductId.entrySet()) {
            String productID = entry.getKey();
            int quantity = entry.getValue();
            Product product = productsById.get(productID);

            if (product == null) {
                throw new BusinessException("Product not found: " + productID, HttpStatus.NOT_FOUND);
            }
            if (Boolean.FALSE.equals(product.getActive())) {
                throw new BusinessException("Product is inactive: " + productID, HttpStatus.CONFLICT);
            }

            int currentStock = Math.max(0, defaultStock(product.getStockQuantity()));
            if (currentStock < quantity) {
                throw new BusinessException(
                        String.format("Insufficient stock for %s. Available=%d, requested=%d", productID, currentStock, quantity),
                        HttpStatus.CONFLICT
                );
            }
        }

        for (Map.Entry<String, Integer> entry : quantityByProductId.entrySet()) {
            Product product = productsById.get(entry.getKey());
            product.setStockQuantity(Math.max(0, defaultStock(product.getStockQuantity()) - entry.getValue()));
        }
        productRepository.saveAll(products);
    }

    @Override
    @Caching(evict = {
            @CacheEvict(cacheNames = RedisCacheConfig.PRODUCTS_ALL, allEntries = true),
            @CacheEvict(cacheNames = RedisCacheConfig.PRODUCTS_SEARCH, allEntries = true),
            @CacheEvict(cacheNames = RedisCacheConfig.PRODUCTS_SUGGEST, allEntries = true),
            @CacheEvict(cacheNames = RedisCacheConfig.PRODUCTS_INVENTORY_HEALTH, allEntries = true),
            @CacheEvict(cacheNames = RedisCacheConfig.ADMIN_DASHBOARD, allEntries = true)
    })
    public void releaseStock(List<StockAdjustmentItemDto> items) {
        Map<String, Integer> quantityByProductId = normalizeRequestItems(items);
        List<Product> products = productRepository.findByProductIDIn(new ArrayList<>(quantityByProductId.keySet()));
        Map<String, Product> productsById = products.stream()
                .collect(Collectors.toMap(Product::getProductID, Function.identity()));

        for (Map.Entry<String, Integer> entry : quantityByProductId.entrySet()) {
            Product product = productsById.get(entry.getKey());
            if (product == null) {
                continue;
            }
            product.setStockQuantity(defaultStock(product.getStockQuantity()) + entry.getValue());
        }
        productRepository.saveAll(products);
    }

    private Map<String, Integer> normalizeRequestItems(List<StockAdjustmentItemDto> items) {
        if (items == null || items.isEmpty()) {
            throw new BusinessException("Items are required", HttpStatus.BAD_REQUEST);
        }

        Map<String, Integer> quantityByProductId = new HashMap<>();
        for (StockAdjustmentItemDto item : items) {
            if (item == null || !StringUtils.hasText(item.getProductID())) {
                throw new BusinessException("Each item must include productID", HttpStatus.BAD_REQUEST);
            }
            int qty = item.getQuantity() == null ? 0 : item.getQuantity();
            if (qty <= 0) {
                throw new BusinessException("Each item quantity must be > 0", HttpStatus.BAD_REQUEST);
            }
            quantityByProductId.merge(item.getProductID().trim(), qty, Integer::sum);
        }
        return quantityByProductId;
    }

    private void applyInventoryDefaults(Product target, ProductDto source) {
        int stock = source.getStockQuantity() == null ? defaultStock(target.getStockQuantity()) : source.getStockQuantity();
        if (stock < 0) {
            throw new BusinessException("stockQuantity must be >= 0", HttpStatus.BAD_REQUEST);
        }
        target.setStockQuantity(stock);

        Boolean active = source.getActive();
        if (active == null) {
            active = target.getActive() == null ? Boolean.TRUE : target.getActive();
        }
        target.setActive(active);
    }

    private int defaultStock(Integer value) {
        if (value == null) {
            return DEFAULT_STOCK_QUANTITY;
        }
        return Math.max(0, value);
    }

    private void addSuggestion(Map<String, String> uniqueSuggestions, String candidate) {
        if (!StringUtils.hasText(candidate)) {
            return;
        }
        String normalized = candidate.trim();
        uniqueSuggestions.putIfAbsent(normalized.toLowerCase(), normalized);
    }

    private int scoreSuggestion(String suggestion, String loweredKeyword) {
        String loweredSuggestion = suggestion.toLowerCase();
        if (loweredSuggestion.equals(loweredKeyword)) {
            return 0;
        }
        if (loweredSuggestion.startsWith(loweredKeyword)) {
            return 1;
        }
        return 2;
    }

    private List<String> tokenizeKeyword(String keyword) {
        String normalized = normalizeForSearch(keyword);
        if (normalized.isBlank()) {
            return List.of();
        }
        return Arrays.stream(normalized.split(" "))
                .filter(StringUtils::hasText)
                .toList();
    }

    private boolean matchesAllTokens(Product product, List<String> tokens) {
        String searchable = normalizeForSearch(product.getProductName()) + " " + normalizeForSearch(product.getProductID());
        for (String token : tokens) {
            if (!searchable.contains(token)) {
                return false;
            }
        }
        return true;
    }

    private String normalizeForSearch(String value) {
        if (!StringUtils.hasText(value)) {
            return "";
        }
        return value
                .toLowerCase(Locale.ROOT)
                .replaceAll("[^a-z0-9]+", " ")
                .trim();
    }
}
