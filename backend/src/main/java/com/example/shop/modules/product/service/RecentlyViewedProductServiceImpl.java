package com.example.shop.modules.product.service;

import com.example.shop.modules.product.dto.ProductDto;
import com.example.shop.modules.product.entity.Product;
import com.example.shop.modules.product.mapper.ProductMapper;
import com.example.shop.modules.product.repository.ProductRepository;
import com.example.shop.modules.user.entity.User;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class RecentlyViewedProductServiceImpl implements RecentlyViewedProductService {

    private final StringRedisTemplate redisTemplate;
    private final ProductRepository productRepository;
    private final ProductMapper productMapper;

    @Value("${application.recently-viewed.max-entries:20}")
    private int maxEntries;

    @Value("${application.recently-viewed.ttl-days:30}")
    private int ttlDays;

    @Override
    public void track(User user, String productId) {
        UUID userId = user == null ? null : user.getId();
        if (userId == null || productId == null || productId.isBlank()) {
            return;
        }
        String key = buildKey(userId);
        String normalizedProductId = productId.trim();
        int safeMaxEntries = Math.max(1, maxEntries);
        try {
            redisTemplate.opsForList().remove(key, 0, normalizedProductId);
            redisTemplate.opsForList().leftPush(key, normalizedProductId);
            redisTemplate.opsForList().trim(key, 0, safeMaxEntries - 1);
            redisTemplate.expire(key, Duration.ofDays(Math.max(1, ttlDays)));
        } catch (Exception ex) {
            log.warn("Failed to track recently viewed product for user {}: {}", userId, ex.getMessage());
        }
    }

    @Override
    public List<ProductDto> getRecentlyViewed(User user, int limit) {
        UUID userId = user == null ? null : user.getId();
        if (userId == null) {
            return List.of();
        }
        int safeLimit = Math.max(1, Math.min(limit <= 0 ? 10 : limit, Math.max(1, maxEntries)));
        String key = buildKey(userId);
        try {
            List<String> values = redisTemplate.opsForList().range(key, 0, safeLimit - 1);
            if (values == null || values.isEmpty()) {
                return List.of();
            }
            Map<String, Product> productsById = productRepository.findByProductIDIn(values)
                    .stream()
                    .collect(Collectors.toMap(Product::getProductID, p -> p));
            Map<String, ProductDto> ordered = new LinkedHashMap<>();
            for (String id : values) {
                Product product = productsById.get(id);
                if (product != null) {
                    ordered.put(id, productMapper.toDto(product));
                }
            }
            return ordered.values().stream().limit(safeLimit).toList();
        } catch (Exception ex) {
            log.warn("Failed to fetch recently viewed products for user {}: {}", userId, ex.getMessage());
            return List.of();
        }
    }

    @Override
    public void clear(User user) {
        UUID userId = user == null ? null : user.getId();
        if (userId == null) {
            return;
        }
        try {
            redisTemplate.delete(buildKey(userId));
        } catch (Exception ex) {
            log.warn("Failed to clear recently viewed products for user {}: {}", userId, ex.getMessage());
        }
    }

    private String buildKey(UUID userId) {
        return "products:recently-viewed:user:" + userId;
    }
}
