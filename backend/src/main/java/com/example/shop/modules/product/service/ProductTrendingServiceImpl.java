package com.example.shop.modules.product.service;

import com.example.shop.modules.product.dto.ProductDto;
import com.example.shop.modules.product.entity.Product;
import com.example.shop.modules.product.mapper.ProductMapper;
import com.example.shop.modules.product.repository.ProductRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ZSetOperations;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.time.Duration;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class ProductTrendingServiceImpl implements ProductTrendingService {

    private static final String TRENDING_KEY = "products:trending:views";

    private final StringRedisTemplate redisTemplate;
    private final ProductRepository productRepository;
    private final ProductMapper productMapper;

    @Value("${application.trending.products.default-limit:12}")
    private int defaultLimit;

    @Value("${application.trending.products.max-limit:50}")
    private int maxLimit;

    @Value("${application.trending.products.ttl-days:30}")
    private int ttlDays;

    @Override
    public void trackProductView(String productId) {
        if (!StringUtils.hasText(productId)) {
            return;
        }
        try {
            redisTemplate.opsForZSet().incrementScore(TRENDING_KEY, productId.trim(), 1D);
            redisTemplate.expire(TRENDING_KEY, Duration.ofDays(Math.max(1, ttlDays)));
        } catch (Exception ex) {
            log.warn("Failed to track product view in Redis for {}: {}", productId, ex.getMessage());
        }
    }

    @Override
    public List<ProductDto> getTrendingProducts(int limit) {
        int normalizedLimit = normalizeLimit(limit);
        try {
            Set<ZSetOperations.TypedTuple<String>> ranked = redisTemplate.opsForZSet()
                    .reverseRangeWithScores(TRENDING_KEY, 0, normalizedLimit - 1);
            if (ranked == null || ranked.isEmpty()) {
                return List.of();
            }

            List<String> rankedProductIds = ranked.stream()
                    .map(ZSetOperations.TypedTuple::getValue)
                    .filter(StringUtils::hasText)
                    .toList();
            if (rankedProductIds.isEmpty()) {
                return List.of();
            }

            Map<String, Product> byProductId = productRepository.findByProductIDIn(rankedProductIds)
                    .stream()
                    .collect(Collectors.toMap(Product::getProductID, p -> p));

            Map<String, ProductDto> ordered = new LinkedHashMap<>();
            for (String productId : rankedProductIds) {
                Product product = byProductId.get(productId);
                if (product != null) {
                    ordered.put(productId, productMapper.toDto(product));
                }
            }
            return ordered.values().stream().limit(normalizedLimit).toList();
        } catch (Exception ex) {
            log.warn("Failed to fetch trending products from Redis: {}", ex.getMessage());
            return List.of();
        }
    }

    private int normalizeLimit(int requestedLimit) {
        int safeMax = Math.max(1, maxLimit);
        int safeDefault = Math.max(1, Math.min(defaultLimit, safeMax));
        int candidate = requestedLimit <= 0 ? safeDefault : requestedLimit;
        return Math.max(1, Math.min(candidate, safeMax));
    }
}
