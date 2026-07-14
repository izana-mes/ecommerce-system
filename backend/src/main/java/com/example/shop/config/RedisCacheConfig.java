package com.example.shop.config;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.cache.Cache;
import org.springframework.cache.CacheManager;
import org.springframework.cache.annotation.CachingConfigurer;
import org.springframework.cache.interceptor.CacheErrorHandler;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.redis.cache.RedisCacheConfiguration;
import org.springframework.data.redis.cache.RedisCacheManager;
import org.springframework.data.redis.connection.RedisConnectionFactory;

import java.time.Duration;
import java.util.HashMap;
import java.util.Map;

@Slf4j
@Configuration
@ConditionalOnProperty(name = "app.cache.backend", havingValue = "redis", matchIfMissing = true)
public class RedisCacheConfig implements CachingConfigurer {

    public static final String PRODUCTS_ALL = "products:all";
    public static final String PRODUCTS_SEARCH = "products:search";
    public static final String PRODUCTS_SUGGEST = "products:suggest";
    public static final String PRODUCTS_INVENTORY_HEALTH = "products:inventory-health";
    public static final String ADMIN_DASHBOARD = "admin:dashboard";
    public static final String STAFF_DASHBOARD = "staff:dashboard";
    public static final String SELLER_DASHBOARD = "seller:dashboard";
    public static final String SUPPLIER_DASHBOARD = "supplier:dashboard";

    @Value("${application.cache.ttl.products-all-seconds:300}")
    private long productsAllTtlSeconds;

    @Value("${application.cache.ttl.products-search-seconds:180}")
    private long productsSearchTtlSeconds;

    @Value("${application.cache.ttl.products-suggest-seconds:180}")
    private long productsSuggestTtlSeconds;

    @Value("${application.cache.ttl.products-inventory-health-seconds:30}")
    private long productsInventoryHealthTtlSeconds;

    @Value("${application.cache.ttl.admin-dashboard-seconds:30}")
    private long adminDashboardTtlSeconds;

    @Value("${application.cache.ttl.staff-dashboard-seconds:30}")
    private long staffDashboardTtlSeconds;

    @Value("${application.cache.ttl.seller-dashboard-seconds:30}")
    private long sellerDashboardTtlSeconds;

    @Value("${application.cache.ttl.supplier-dashboard-seconds:30}")
    private long supplierDashboardTtlSeconds;

    @Bean
    public CacheManager cacheManager(RedisConnectionFactory redisConnectionFactory) {
        RedisCacheConfiguration base = RedisCacheConfiguration.defaultCacheConfig()
                .disableCachingNullValues();

        Map<String, RedisCacheConfiguration> perCacheConfig = new HashMap<>();
        perCacheConfig.put(PRODUCTS_ALL, base.entryTtl(Duration.ofSeconds(normalizeTtl(productsAllTtlSeconds))));
        perCacheConfig.put(PRODUCTS_SEARCH, base.entryTtl(Duration.ofSeconds(normalizeTtl(productsSearchTtlSeconds))));
        perCacheConfig.put(PRODUCTS_SUGGEST, base.entryTtl(Duration.ofSeconds(normalizeTtl(productsSuggestTtlSeconds))));
        perCacheConfig.put(PRODUCTS_INVENTORY_HEALTH, base.entryTtl(Duration.ofSeconds(normalizeTtl(productsInventoryHealthTtlSeconds))));
        perCacheConfig.put(ADMIN_DASHBOARD, base.entryTtl(Duration.ofSeconds(normalizeTtl(adminDashboardTtlSeconds))));
        perCacheConfig.put(STAFF_DASHBOARD, base.entryTtl(Duration.ofSeconds(normalizeTtl(staffDashboardTtlSeconds))));
        perCacheConfig.put(SELLER_DASHBOARD, base.entryTtl(Duration.ofSeconds(normalizeTtl(sellerDashboardTtlSeconds))));
        perCacheConfig.put(SUPPLIER_DASHBOARD, base.entryTtl(Duration.ofSeconds(normalizeTtl(supplierDashboardTtlSeconds))));

        return RedisCacheManager.builder(redisConnectionFactory)
                .cacheDefaults(base)
                .withInitialCacheConfigurations(perCacheConfig)
                .transactionAware()
                .build();
    }

    /**
     * Lenient cache error handler: logs the failure and silently bypasses the cache
     * instead of propagating a Redis exception as an HTTP 500 to the client.
     */
    @Override
    public CacheErrorHandler errorHandler() {
        return new CacheErrorHandler() {
            @Override
            public void handleCacheGetError(RuntimeException e, Cache cache, Object key) {
                log.warn("Cache GET error on '{}' key='{}': {}", cache.getName(), key, e.getMessage());
            }

            @Override
            public void handleCachePutError(RuntimeException e, Cache cache, Object key, Object value) {
                log.warn("Cache PUT error on '{}' key='{}': {}", cache.getName(), key, e.getMessage());
            }

            @Override
            public void handleCacheEvictError(RuntimeException e, Cache cache, Object key) {
                log.warn("Cache EVICT error on '{}' key='{}': {}", cache.getName(), key, e.getMessage());
            }

            @Override
            public void handleCacheClearError(RuntimeException e, Cache cache) {
                log.warn("Cache CLEAR error on '{}': {}", cache.getName(), e.getMessage());
            }
        };
    }

    private long normalizeTtl(long ttlSeconds) {
        return Math.max(1, ttlSeconds);
    }
}
