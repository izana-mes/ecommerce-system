package com.example.shop.config;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.cache.CacheManager;
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
public class RedisCacheConfig {

    public static final String PRODUCTS_ALL = "products:all";
    public static final String PRODUCTS_SEARCH = "products:search";
    public static final String PRODUCTS_SUGGEST = "products:suggest";
    public static final String PRODUCTS_INVENTORY_HEALTH = "products:inventory-health";
    public static final String ADMIN_DASHBOARD = "admin:dashboard";
    public static final String STAFF_DASHBOARD = "staff:dashboard";

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

        return RedisCacheManager.builder(redisConnectionFactory)
                .cacheDefaults(base)
                .withInitialCacheConfigurations(perCacheConfig)
                .transactionAware()
                .build();
    }

    private long normalizeTtl(long ttlSeconds) {
        return Math.max(1, ttlSeconds);
    }
}
