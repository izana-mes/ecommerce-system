package com.example.shop.modules.cart.service;

import com.example.shop.common.exception.BusinessException;
import com.example.shop.config.CacheInvalidationEventPublisher;
import com.example.shop.config.RedisCacheConfig;
import com.example.shop.modules.cart.dto.CartAddRequest;
import com.example.shop.modules.cart.dto.CartCheckoutHealthItemDto;
import com.example.shop.modules.cart.dto.CartCheckoutHealthResponseDto;
import com.example.shop.modules.cart.dto.CartItemDto;
import com.example.shop.modules.cart.entity.CartItem;
import com.example.shop.modules.cart.repository.CartItemRepository;
import com.example.shop.modules.product.entity.Product;
import com.example.shop.modules.product.repository.ProductRepository;
import com.example.shop.modules.user.entity.User;
import lombok.RequiredArgsConstructor;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Caching;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Transactional
public class CartServiceImpl implements CartService {

    private static final int MAX_QUANTITY = 20;

    private final CartItemRepository cartItemRepository;
    private final ProductRepository productRepository;
    private final CacheInvalidationEventPublisher cacheInvalidationEventPublisher;

    @Override
    @Transactional(readOnly = true)
    public List<CartItemDto> getCart(User user) {
        List<CartItem> items = cartItemRepository.findByUser(user);
        Map<String, Product> productsById = getProductsById(items);
        return items.stream()
                .map(item -> {
                    Product product = productsById.get(item.getProductID());
                    int maxAllowedByStock = computeMaxAllowedByStock(product);
                    return toDto(item, product, maxAllowedByStock);
                })
                .toList();
    }

    @Override
    @Caching(evict = {
            @CacheEvict(cacheNames = RedisCacheConfig.PRODUCTS_INVENTORY_HEALTH, allEntries = true),
            @CacheEvict(cacheNames = RedisCacheConfig.ADMIN_DASHBOARD, allEntries = true)
    })
    public CartItemDto addToCart(User user, CartAddRequest request) {
        Product product = getAvailableProduct(request.getProductID());

        CartItem item = cartItemRepository.findByUserAndProductID(user, request.getProductID())
                .orElseGet(() -> CartItem.builder()
                        .user(user)
                        .productID(product.getProductID())
                        .productName(product.getProductName())
                        .productPrice(product.getProductPrice())
                        .productReviews(product.getProductReviews())
                        .quantity(0)
                        .build());

        int ownQty = normalizeQuantity(item.getQuantity());
        int maxAllowedByStock = computeMaxAllowedByStock(product);
        if (maxAllowedByStock <= 0) {
            throw new BusinessException("Product is out of stock", HttpStatus.CONFLICT);
        }
        int newQty = ownQty + 1;
        if (newQty > maxAllowedByStock) {
            throw new BusinessException("Cannot exceed available stock", HttpStatus.CONFLICT);
        }

        item.setProductName(product.getProductName());
        item.setProductPrice(product.getProductPrice());
        item.setProductReviews(product.getProductReviews());
        item.setQuantity(newQty);

        CartItem saved = cartItemRepository.save(item);
        publishCartCacheInvalidation();
        return toDto(saved, product, maxAllowedByStock);
    }

    @Override
    @Caching(evict = {
            @CacheEvict(cacheNames = RedisCacheConfig.PRODUCTS_INVENTORY_HEALTH, allEntries = true),
            @CacheEvict(cacheNames = RedisCacheConfig.ADMIN_DASHBOARD, allEntries = true)
    })
    public CartItemDto updateQuantity(User user, String productID, int quantity) {
        if (quantity <= 0) {
            CartItem item = cartItemRepository.findByUserAndProductID(user, productID)
                    .orElseThrow(() -> new BusinessException("Cart item not found", HttpStatus.NOT_FOUND));

            cartItemRepository.delete(item);
            item.setQuantity(0);
            publishCartCacheInvalidation();
            return toDto(item, null, 0);
        }

        CartItem item = cartItemRepository.findByUserAndProductID(user, productID)
                .orElseThrow(() -> new BusinessException("Cart item not found", HttpStatus.NOT_FOUND));

        Product product = getAvailableProduct(productID);
        int maxAllowedByStock = computeMaxAllowedByStock(product);
        if (maxAllowedByStock <= 0) {
            throw new BusinessException("Product is out of stock", HttpStatus.CONFLICT);
        }
        if (quantity > maxAllowedByStock) {
            throw new BusinessException(
                    String.format("Only %d item(s) left in stock", maxAllowedByStock),
                    HttpStatus.CONFLICT
            );
        }

        item.setProductName(product.getProductName());
        item.setProductPrice(product.getProductPrice());
        item.setProductReviews(product.getProductReviews());
        item.setQuantity(quantity);
        CartItem saved = cartItemRepository.save(item);
        publishCartCacheInvalidation();
        return toDto(saved, product, maxAllowedByStock);
    }

    @Override
    @Caching(evict = {
            @CacheEvict(cacheNames = RedisCacheConfig.PRODUCTS_INVENTORY_HEALTH, allEntries = true),
            @CacheEvict(cacheNames = RedisCacheConfig.ADMIN_DASHBOARD, allEntries = true)
    })
    public void removeFromCart(User user, String productID) {
        cartItemRepository.deleteByUserAndProductID(user, productID);
        publishCartCacheInvalidation();
    }

    @Override
    @Caching(evict = {
            @CacheEvict(cacheNames = RedisCacheConfig.PRODUCTS_INVENTORY_HEALTH, allEntries = true),
            @CacheEvict(cacheNames = RedisCacheConfig.ADMIN_DASHBOARD, allEntries = true)
    })
    public void clearCart(User user) {
        cartItemRepository.deleteByUser(user);
        publishCartCacheInvalidation();
    }

    @Override
    @Transactional(readOnly = true)
    public CartCheckoutHealthResponseDto getCheckoutHealth(User user) {
        List<CartItem> items = cartItemRepository.findByUser(user);
        Map<String, Product> productsById = getProductsById(items);

        List<CartCheckoutHealthItemDto> invalidItems = items.stream()
                .map(item -> {
                    Product product = productsById.get(item.getProductID());
                    int maxAllowedByStock = computeMaxAllowedByStock(product);
                    return buildCheckoutIssue(item, product, maxAllowedByStock);
                })
                .filter(issue -> issue != null)
                .toList();

        return CartCheckoutHealthResponseDto.builder()
                .canCheckout(invalidItems.isEmpty())
                .itemCount(items.size())
                .invalidItemCount(invalidItems.size())
                .invalidItems(invalidItems)
                .build();
    }

    private Product getAvailableProduct(String productID) {
        if (!StringUtils.hasText(productID)) {
            throw new BusinessException("productID is required", HttpStatus.BAD_REQUEST);
        }
        Product product = productRepository.findByProductID(productID)
                .orElseThrow(() -> new BusinessException("Product not found", HttpStatus.NOT_FOUND));
        if (Boolean.FALSE.equals(product.getActive())) {
            throw new BusinessException("Product is inactive", HttpStatus.CONFLICT);
        }
        int stockQuantity = product.getStockQuantity() == null ? 25 : product.getStockQuantity();
        product.setStockQuantity(stockQuantity);
        if (stockQuantity <= 0) {
            throw new BusinessException("Product is out of stock", HttpStatus.CONFLICT);
        }
        return product;
    }

    private Map<String, Product> getProductsById(List<CartItem> items) {
        List<String> productIds = items.stream()
                .map(CartItem::getProductID)
                .distinct()
                .toList();
        if (productIds.isEmpty()) {
            return Map.of();
        }
        return productRepository.findByProductIDIn(productIds)
                .stream()
                .collect(Collectors.toMap(Product::getProductID, Function.identity()));
    }

    private CartCheckoutHealthItemDto buildCheckoutIssue(CartItem cartItem, Product product, int maxAllowedByStock) {
        int requestedQty = Math.max(0, cartItem.getQuantity() == null ? 0 : cartItem.getQuantity());
        String productName = product == null ? cartItem.getProductName() : product.getProductName();

        if (product == null) {
            return CartCheckoutHealthItemDto.builder()
                    .productID(cartItem.getProductID())
                    .productName(productName)
                    .requestedQuantity(requestedQty)
                    .availableQuantity(0)
                    .active(false)
                    .reason("PRODUCT_NOT_FOUND")
                    .build();
        }

        boolean active = !Boolean.FALSE.equals(product.getActive());

        if (!active) {
            return CartCheckoutHealthItemDto.builder()
                    .productID(cartItem.getProductID())
                    .productName(productName)
                    .requestedQuantity(requestedQty)
                    .availableQuantity(0)
                    .active(false)
                    .reason("PRODUCT_INACTIVE")
                    .build();
        }

        if (maxAllowedByStock <= 0) {
            return CartCheckoutHealthItemDto.builder()
                    .productID(cartItem.getProductID())
                    .productName(productName)
                    .requestedQuantity(requestedQty)
                    .availableQuantity(0)
                    .active(true)
                    .reason("OUT_OF_STOCK")
                    .build();
        }

        if (requestedQty > maxAllowedByStock) {
            return CartCheckoutHealthItemDto.builder()
                    .productID(cartItem.getProductID())
                    .productName(productName)
                    .requestedQuantity(requestedQty)
                    .availableQuantity(maxAllowedByStock)
                    .active(true)
                    .reason("INSUFFICIENT_STOCK")
                    .build();
        }

        return null;
    }

    private CartItemDto toDto(CartItem entity, Product product, int maxAllowedByStock) {
        if (entity == null) {
            return null;
        }

        boolean active = product == null || !Boolean.FALSE.equals(product.getActive());
        int requestedQty = Math.max(0, entity.getQuantity() == null ? 0 : entity.getQuantity());
        boolean purchasable = product != null && active && maxAllowedByStock > 0 && requestedQty <= maxAllowedByStock;

        CartItemDto dto = new CartItemDto();
        dto.setProductID(entity.getProductID());
        dto.setProductName(product == null ? entity.getProductName() : product.getProductName());
        dto.setProductPrice(product == null ? entity.getProductPrice() : product.getProductPrice());
        dto.setProductReviews(product == null ? entity.getProductReviews() : product.getProductReviews());
        dto.setQuantity(entity.getQuantity());
        dto.setAvailableStock(maxAllowedByStock);
        dto.setActive(active);
        dto.setPurchasable(purchasable);
        return dto;
    }

    private int computeMaxAllowedByStock(Product product) {
        if (product == null) {
            return 0;
        }
        return Math.min(MAX_QUANTITY, normalizeStock(product.getStockQuantity()));
    }

    private int normalizeStock(Integer stockQuantity) {
        return Math.max(0, stockQuantity == null ? 25 : stockQuantity);
    }

    private int normalizeQuantity(Integer quantity) {
        return Math.max(0, quantity == null ? 0 : quantity);
    }

    private void publishCartCacheInvalidation() {
        cacheInvalidationEventPublisher.publish(List.of(
                RedisCacheConfig.PRODUCTS_INVENTORY_HEALTH,
                RedisCacheConfig.ADMIN_DASHBOARD,
                RedisCacheConfig.STAFF_DASHBOARD,
                RedisCacheConfig.SELLER_DASHBOARD,
                RedisCacheConfig.SUPPLIER_DASHBOARD
        ));
    }
}
