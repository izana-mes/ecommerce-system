package com.example.shop.modules.product.service;

import com.example.shop.common.exception.BusinessException;
import com.example.shop.config.CacheInvalidationEventPublisher;
import com.example.shop.config.RedisCacheConfig;
import com.example.shop.modules.cart.repository.CartItemRepository;
import com.example.shop.modules.cart.repository.CartReservedStockProjection;
import com.example.shop.modules.messaging.inventory.LowStockAlertEvent;
import com.example.shop.modules.messaging.inventory.LowStockAlertPublisher;
import com.example.shop.modules.product.dto.ProductDto;
import com.example.shop.modules.product.dto.ProductSuggestionDto;
import com.example.shop.modules.product.dto.StockAdjustmentItemDto;
import com.example.shop.modules.product.entity.Product;
import com.example.shop.modules.product.mapper.ProductMapper;
import com.example.shop.modules.product.repository.ProductRepository;
import com.example.shop.modules.user.entity.User;
import com.example.shop.modules.user.entity.SupplierOperatingMode;
import com.example.shop.modules.user.repository.UserRepository;
import com.example.shop.modules.resale.entity.SupplierProduct;
import com.example.shop.modules.resale.repository.SupplierProductRepository;
import com.example.shop.modules.resale.repository.SellerProductListingRepository;
import com.example.shop.modules.resale.service.SellerListingCatalog;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.cache.annotation.Caching;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.data.domain.PageRequest;
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
@Slf4j
public class ProductServiceImpl implements ProductService {

    private static final int DEFAULT_STOCK_QUANTITY = 25;
    private static final String DEFAULT_CATEGORY = "Uncategorized";

    private final ProductRepository productRepository;
    private final ProductMapper productMapper;
    private final CartItemRepository cartItemRepository;
    private final CacheInvalidationEventPublisher cacheInvalidationEventPublisher;
    private final LowStockAlertPublisher lowStockAlertPublisher;
    private final UserRepository userRepository;
    private final SupplierProductRepository supplierProductRepository;
    private final SellerProductListingRepository sellerProductListingRepository;
    private final SellerListingCatalog sellerListingCatalog;
    private final JdbcTemplate jdbcTemplate;

    @Value("${application.inventory.low-stock-threshold:5}")
    private int lowStockThreshold;


    @Override
    @Transactional(readOnly = true)
    public List<ProductDto> getAllProducts() {
        // Public catalog: only active (approved/published) products are visible.
        List<ProductDto> result = productRepository.findAllByOrderByIdAsc()
                .stream()
                .filter(p -> Boolean.TRUE.equals(p.getActive()))
                .filter(this::supplierMaySellDirectly)
                .map(this::toRetailDto)
                .collect(Collectors.toCollection(ArrayList::new));
        sellerProductListingRepository.findByActiveTrueOrderByCreatedAtDesc().forEach(listing -> {
            try {
                String catalogId = "LISTING:" + listing.getId();
                ProductDto dto = productMapper.toDto(sellerListingCatalog.retailProduct(sellerListingCatalog.resolve(catalogId), catalogId));
                result.add(dto);
            } catch (BusinessException ignored) { /* inactive authorization or unavailable Supplier offer */ }
        });
        supplierProductRepository.findEligibleDirectRetailOffers().stream()
                .filter(offer -> offer.getSupplier().getSupplierOperatingMode() == SupplierOperatingMode.SUPPLY_AND_SELL)
                .forEach(offer -> {
                    String catalogId = "SUPPLIER:" + offer.getId();
                    result.add(productMapper.toDto(sellerListingCatalog.directRetailProduct(offer, catalogId)));
                });
        return result;
    }

    @Override
    @Transactional(readOnly = true)
    public List<ProductDto> searchProducts(String keyword) {
        if (!StringUtils.hasText(keyword)) {
            return getAllProducts();
        }

        String normalized = keyword.trim();
        List<String> tokens = tokenizeKeyword(normalized);
        if (tokens.isEmpty()) {
            return getAllProducts();
        }

        Map<String, ProductDto> unique = new LinkedHashMap<>();
        for (ProductDto product : getAllProducts()) {
            if (Boolean.TRUE.equals(product.getActive()) && matchesAllTokens(product, tokens)) {
                unique.putIfAbsent(product.getProductID(), product);
            }
        }
        return new ArrayList<>(unique.values());
    }

    private boolean supplierMaySellDirectly(Product product) {
        // Supplier-owned items use a listing-specific SUPPLIER:<offer UUID> catalog key.
        // This prevents a Global Product row from bypassing explicit offer-level retail settings.
        return product.getSupplierUserId() == null;
    }

    private ProductDto toRetailDto(Product product) {
        ProductDto dto = productMapper.toDto(product);
        if (product.getSupplierUserId() != null) {
            supplierProductRepository.findBySupplierIdAndProductProductID(product.getSupplierUserId(), product.getProductID())
                    .filter(offer -> Boolean.TRUE.equals(offer.getDirectRetailEnabled()))
                    .map(SupplierProduct::getDirectRetailPrice)
                    .ifPresent(price -> dto.setProductPrice(price.doubleValue()));
        }
        return dto;
    }

    private static String safe(String value) { return value == null ? "" : value; }

    @Override
    @Transactional(readOnly = true)
    public List<ProductDto> getActiveProducts(int limit) {
        return productRepository.findByActiveTrueOrderByIdAsc(PageRequest.of(0, Math.max(1, Math.min(limit, 50))))
                .stream().filter(this::supplierMaySellDirectly).map(this::toRetailDto).toList();
    }

    @Override
    @Transactional(readOnly = true)
    public ProductDto getProductForViewer(String productID, User actor) {
        if (!StringUtils.hasText(productID)) {
            throw new BusinessException("Product ID is required", HttpStatus.BAD_REQUEST);
        }
        if (productID.trim().startsWith("LISTING:")) {
            String key = productID.trim();
            return productMapper.toDto(sellerListingCatalog.retailProduct(sellerListingCatalog.resolve(key), key));
        }
        if (productID.trim().startsWith("SUPPLIER:")) {
            String key = productID.trim();
            return productMapper.toDto(sellerListingCatalog.directRetailProduct(sellerListingCatalog.resolveDirectOffer(key), key));
        }
        Product product = productRepository.findByProductID(productID.trim())
                .orElseThrow(() -> new BusinessException("Product not found", HttpStatus.NOT_FOUND));

        boolean isActive = Boolean.TRUE.equals(product.getActive());
        boolean hasDirectRetailAccess = product.getSupplierUserId() == null || supplierMaySellDirectly(product)
                || actor != null && actor.getId().equals(product.getSupplierUserId());
        if (isActive && !hasDirectRetailAccess) {
            throw new BusinessException("Product is supplied wholesale and is not directly available for retail", HttpStatus.NOT_FOUND);
        }
        if (!isActive) {
            boolean isAuthorized = actor != null && (
                    hasUserRole(actor, "ROLE_ADMIN")
                    || hasUserRole(actor, "ROLE_EMPLOYEE")
                    || (hasUserRole(actor, "ROLE_SELLER") && actor.getId().equals(product.getSellerUserId()))
                    || (hasUserRole(actor, "ROLE_SUPPLIER") && actor.getId().equals(product.getSupplierUserId()))
            );
            if (!isAuthorized) {
                throw new BusinessException("Product not found", HttpStatus.NOT_FOUND);
            }
        }

        return toRetailDto(product);
    }

    private static boolean hasUserRole(User user, String roleName) {
        if (user == null || user.getRoles() == null) {
            return false;
        }
        return user.getRoles().stream()
                .anyMatch(r -> roleName.equalsIgnoreCase(r.getName())
                        || roleName.equalsIgnoreCase("ROLE_" + r.getName()));
    }

    @Override
    @Transactional(readOnly = true)
    public List<ProductSuggestionDto> searchSuggestions(String keyword, int limit) {
        if (!StringUtils.hasText(keyword)) {
            return List.of();
        }

        String normalized = keyword.trim();
        int normalizedLimit = Math.max(1, Math.min(limit, 15));
        List<String> tokens = tokenizeKeyword(normalized);
        if (tokens.isEmpty()) {
            return List.of();
        }

        String loweredKeyword = normalized.toLowerCase();
        Map<String, ProductDto> uniqueProducts = new LinkedHashMap<>();
        for (ProductDto product : getAllProducts()) {
            if (Boolean.TRUE.equals(product.getActive()) && matchesAllTokens(product, tokens)) {
                uniqueProducts.putIfAbsent(product.getProductID(), product);
            }
        }

        Comparator<ProductDto> suggestionComparator = Comparator
                .comparingInt((ProductDto value) -> scoreSuggestion(safe(value.getProductName()).toLowerCase(Locale.ROOT), loweredKeyword))
                .thenComparing(value -> safe(value.getProductName()), String.CASE_INSENSITIVE_ORDER)
                .thenComparing(ProductDto::getProductID, Comparator.nullsLast(String::compareTo));

        return uniqueProducts.values().stream()
                .sorted(suggestionComparator)
                .limit(normalizedLimit)
                .map(product -> ProductSuggestionDto.builder()
                        .productID(product.getProductID())
                        .productName(product.getProductName())
                        .frontImg(product.getFrontImg())
                        .productPrice(product.getProductPrice())
                        .sellerUserId(product.getSellerUserId())
                        .supplierUserId(product.getSupplierUserId())
                        .build())
                .toList();
    }

    @Override
    @Caching(evict = {
            @CacheEvict(cacheNames = RedisCacheConfig.PRODUCTS_ALL, allEntries = true),
            @CacheEvict(cacheNames = RedisCacheConfig.PRODUCTS_ACTIVE, allEntries = true),
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
        entity.setCategory(normalizeCategory(productDto.getCategory()));
        if (productDto.getSupplierUserId() != null) {
            entity.setSupplierUserId(productDto.getSupplierUserId());
        }
        Product saved = productRepository.save(entity);
        publishProductCacheInvalidation();
        return productMapper.toDto(saved);
    }

    @Override
    @Caching(evict = {
            @CacheEvict(cacheNames = RedisCacheConfig.PRODUCTS_ALL, allEntries = true),
            @CacheEvict(cacheNames = RedisCacheConfig.PRODUCTS_ACTIVE, allEntries = true),
            @CacheEvict(cacheNames = RedisCacheConfig.PRODUCTS_SEARCH, allEntries = true),
            @CacheEvict(cacheNames = RedisCacheConfig.PRODUCTS_SUGGEST, allEntries = true),
            @CacheEvict(cacheNames = RedisCacheConfig.PRODUCTS_INVENTORY_HEALTH, allEntries = true),
            @CacheEvict(cacheNames = RedisCacheConfig.ADMIN_DASHBOARD, allEntries = true)
    })
    public List<ProductDto> saveAllProducts(List<ProductDto> products) {
        List<Product> entities = products.stream()
                .map(dto -> productRepository.findByProductID(dto.getProductID())
                        .map(existing -> {
                            if (dto.getProductPrice() != null
                                    && existing.getProductPrice() != null
                                    && Double.compare(existing.getProductPrice(), dto.getProductPrice()) != 0) {
                                existing.setOldPrice(existing.getProductPrice());
                            }
                            existing.setFrontImg(dto.getFrontImg());
                            existing.setBackImg(dto.getBackImg());
                            existing.setProductName(dto.getProductName());
                            existing.setProductPrice(dto.getProductPrice());
                            existing.setProductReviews(dto.getProductReviews());
                            existing.setCategory(normalizeCategory(dto.getCategory()));
                            existing.setSizes(productMapper.map(dto.getSizes()));
                            applyInventoryDefaults(existing, dto);
                            return existing;
                        })
                        .orElseGet(() -> {
                            Product entity = productMapper.toEntity(dto);
                            applyInventoryDefaults(entity, dto);
                            entity.setCategory(normalizeCategory(dto.getCategory()));
                            return entity;
                        }))
                .toList();

        List<ProductDto> saved = productRepository.saveAll(entities)
                .stream()
                .map(productMapper::toDto)
                .toList();
        publishProductCacheInvalidation();
        return saved;
    }

    @Override
    @Caching(evict = {
            @CacheEvict(cacheNames = RedisCacheConfig.PRODUCTS_ALL, allEntries = true),
            @CacheEvict(cacheNames = RedisCacheConfig.PRODUCTS_ACTIVE, allEntries = true),
            @CacheEvict(cacheNames = RedisCacheConfig.PRODUCTS_SEARCH, allEntries = true),
            @CacheEvict(cacheNames = RedisCacheConfig.PRODUCTS_SUGGEST, allEntries = true),
            @CacheEvict(cacheNames = RedisCacheConfig.PRODUCTS_INVENTORY_HEALTH, allEntries = true),
            @CacheEvict(cacheNames = RedisCacheConfig.ADMIN_DASHBOARD, allEntries = true)
    })
    public ProductDto updateProduct(String productID, ProductDto dto) {
        if (productID != null && (productID.startsWith("LISTING:") || productID.startsWith("SUPPLIER:"))) {
            throw new BusinessException("Catalog listing IDs must be updated through their owning Seller or Supplier endpoint", HttpStatus.BAD_REQUEST);
        }
        Product existing = productRepository.findByProductID(productID)
                .orElseThrow(() -> new IllegalArgumentException("Product not found: " + productID));

        if (dto.getProductPrice() != null
                && existing.getProductPrice() != null
                && Double.compare(existing.getProductPrice(), dto.getProductPrice()) != 0) {
            existing.setOldPrice(existing.getProductPrice());
        }
        existing.setFrontImg(dto.getFrontImg());
        existing.setBackImg(dto.getBackImg());
        existing.setProductName(dto.getProductName());
        existing.setProductPrice(dto.getProductPrice());
        existing.setProductReviews(dto.getProductReviews());
        existing.setCategory(normalizeCategory(dto.getCategory()));
        existing.setSizes(productMapper.map(dto.getSizes()));
        applyInventoryDefaults(existing, dto);
        if (dto.getSupplierUserId() != null) {
            existing.setSupplierUserId(dto.getSupplierUserId());
        }

        Product saved = productRepository.save(existing);
        publishProductCacheInvalidation();
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
    @Transactional(readOnly = true)
    public List<ProductDto> listProductsOwnedBySeller(UUID sellerUserId) {
        if (sellerUserId == null) {
            return List.of();
        }
        return productRepository.findBySellerUserIdOrderByIdAsc(sellerUserId)
                .stream()
                .map(productMapper::toDto)
                .toList();
    }

    @Override
    @Caching(evict = {
            @CacheEvict(cacheNames = RedisCacheConfig.PRODUCTS_ALL, allEntries = true),
            @CacheEvict(cacheNames = RedisCacheConfig.PRODUCTS_ACTIVE, allEntries = true),
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
        publishProductCacheInvalidation();
    }

    @Override
    @Caching(evict = {
            @CacheEvict(cacheNames = RedisCacheConfig.PRODUCTS_ALL, allEntries = true),
            @CacheEvict(cacheNames = RedisCacheConfig.PRODUCTS_ACTIVE, allEntries = true),
            @CacheEvict(cacheNames = RedisCacheConfig.PRODUCTS_SEARCH, allEntries = true),
            @CacheEvict(cacheNames = RedisCacheConfig.PRODUCTS_SUGGEST, allEntries = true),
            @CacheEvict(cacheNames = RedisCacheConfig.PRODUCTS_INVENTORY_HEALTH, allEntries = true),
            @CacheEvict(cacheNames = RedisCacheConfig.ADMIN_DASHBOARD, allEntries = true)
    })
    public void assignSellerToProduct(String productId, UUID sellerUserId) {
        if (!StringUtils.hasText(productId) || sellerUserId == null) {
            return;
        }
        Product existing = productRepository.findByProductID(productId)
                .orElseThrow(() -> new IllegalArgumentException("Product not found: " + productId));
        existing.setSellerUserId(sellerUserId);
        productRepository.save(existing);
        publishProductCacheInvalidation();
    }

    @Override
    @Caching(evict = {
            @CacheEvict(cacheNames = RedisCacheConfig.PRODUCTS_ALL, allEntries = true),
            @CacheEvict(cacheNames = RedisCacheConfig.PRODUCTS_ACTIVE, allEntries = true),
            @CacheEvict(cacheNames = RedisCacheConfig.PRODUCTS_SEARCH, allEntries = true),
            @CacheEvict(cacheNames = RedisCacheConfig.PRODUCTS_SUGGEST, allEntries = true),
            @CacheEvict(cacheNames = RedisCacheConfig.PRODUCTS_INVENTORY_HEALTH, allEntries = true),
            @CacheEvict(cacheNames = RedisCacheConfig.ADMIN_DASHBOARD, allEntries = true)
    })
    public void deleteProduct(String productID) {
        if (!StringUtils.hasText(productID)) {
            return;
        }
        String normalizedId = productID.trim();
        Product existing = productRepository.findByProductID(normalizedId).orElse(null);
        if (existing == null) {
            log.warn("Product with ID {} not found for deletion; treating as already deleted", normalizedId);
            publishProductCacheInvalidation();
            return;
        }

        int resaleAuthCount = queryCount(
                "SELECT COUNT(*) FROM seller_resale_authorizations WHERE supplier_product_id = ?",
                normalizedId
        );
        int listingCount = queryCount(
                "SELECT COUNT(*) FROM seller_product_listings WHERE supplier_product_id = ?",
                normalizedId
        );
        int supplierProductCount = queryCount(
                "SELECT COUNT(*) FROM supplier_products WHERE product_id = ?",
                normalizedId
        );
        int orderItemCount = queryCount(
                "SELECT COUNT(*) FROM order_items WHERE product_id = ?",
                normalizedId
        );

        boolean hasCommercialReferences = (resaleAuthCount + listingCount + supplierProductCount + orderItemCount) > 0;

        if (hasCommercialReferences) {
            existing.setActive(false);
            productRepository.save(existing);

            jdbcTemplate.update(
                    "UPDATE seller_product_listings SET active = false, updated_at = CURRENT_TIMESTAMP WHERE supplier_product_id = ? AND active = true",
                    normalizedId
            );
            jdbcTemplate.update(
                    "UPDATE supplier_products SET available = false, approved = false, allow_resale = false, updated_at = CURRENT_TIMESTAMP WHERE product_id = ?",
                    normalizedId
            );
            jdbcTemplate.update(
                    "UPDATE seller_resale_authorizations SET is_active = false, revoked_at = CURRENT_TIMESTAMP, revoke_reason = 'Product removed from catalog', updated_at = CURRENT_TIMESTAMP WHERE supplier_product_id = ? AND is_active = true",
                    normalizedId
            );
            jdbcTemplate.update(
                    "UPDATE supplier_resale_catalog_flags SET resale_enabled = false, supplier_product_approved = false, updated_at = CURRENT_TIMESTAMP WHERE product_id = ?",
                    normalizedId
            );
        } else {
            jdbcTemplate.update("DELETE FROM cart_items WHERE product_id = ?", normalizedId);
            jdbcTemplate.update("DELETE FROM wishlist_items WHERE product_id = ?", normalizedId);
            jdbcTemplate.update("DELETE FROM supplier_resale_catalog_flags WHERE product_id = ?", normalizedId);
            productRepository.delete(existing);
        }

        publishProductCacheInvalidation();
    }

    private int queryCount(String sql, String param) {
        try {
            Integer count = jdbcTemplate.queryForObject(sql, Integer.class, param);
            return count != null ? count : 0;
        } catch (Exception ex) {
            log.error("Failed to query reference count with sql: {}", sql, ex);
            return 1;
        }
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
            @CacheEvict(cacheNames = RedisCacheConfig.PRODUCTS_ACTIVE, allEntries = true),
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
        publishProductCacheInvalidation();

        // Publish low-stock alerts after the DB write (fire-and-forget; non-critical).
        for (Product product : products) {
            int remaining = Math.max(0, defaultStock(product.getStockQuantity()));
            if (remaining <= lowStockThreshold) {
                lowStockAlertPublisher.publish(LowStockAlertEvent.builder()
                        .productId(product.getProductID())
                        .productName(product.getProductName())
                        .remainingStock(remaining)
                        .orderNumber("") // order number not available here; populated when called from order flow
                        .build());
            }
        }
    }

    @Override
    @Caching(evict = {
            @CacheEvict(cacheNames = RedisCacheConfig.PRODUCTS_ALL, allEntries = true),
            @CacheEvict(cacheNames = RedisCacheConfig.PRODUCTS_ACTIVE, allEntries = true),
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
        publishProductCacheInvalidation();
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

    private boolean matchesAllTokens(ProductDto product, List<String> tokens) {
        String searchable = normalizeForSearch(product.getProductName())
                + " " + normalizeForSearch(product.getProductID())
                + " " + normalizeForSearch(product.getCategory())
                + " " + normalizeForSearch(product.getSku())
                + " " + normalizeForSearch(product.getBrand());
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

    private String normalizeCategory(String category) {
        if (!StringUtils.hasText(category)) {
            return DEFAULT_CATEGORY;
        }
        return category.trim();
    }

    private void publishProductCacheInvalidation() {
        cacheInvalidationEventPublisher.publish(List.of(
                RedisCacheConfig.PRODUCTS_ALL,
                RedisCacheConfig.PRODUCTS_ACTIVE,
                RedisCacheConfig.PRODUCTS_SEARCH,
                RedisCacheConfig.PRODUCTS_SUGGEST,
                RedisCacheConfig.PRODUCTS_INVENTORY_HEALTH,
                RedisCacheConfig.ADMIN_DASHBOARD,
                RedisCacheConfig.STAFF_DASHBOARD,
                RedisCacheConfig.SELLER_DASHBOARD,
                RedisCacheConfig.SUPPLIER_DASHBOARD
        ));
    }
}
