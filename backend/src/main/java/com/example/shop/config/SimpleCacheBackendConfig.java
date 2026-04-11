package com.example.shop.config;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.cache.CacheManager;
import org.springframework.cache.concurrent.ConcurrentMapCacheManager;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import lombok.extern.slf4j.Slf4j;

/**
 * In-process cache when {@code app.cache.backend=simple} (set automatically on Render via
 * {@link RenderIntegrationEnvironmentPostProcessor} when {@code RENDER=true}). Entries do not expire
 * by TTL until evicted by the service; sufficient for a small catalog on free-tier hosting.
 */
@Slf4j
@Configuration
@ConditionalOnProperty(name = "app.cache.backend", havingValue = "simple")
public class SimpleCacheBackendConfig {

    @Bean
    public CacheManager cacheManager() {
        log.info("Using ConcurrentMap in-process cache (app.cache.backend=simple)");
        return new ConcurrentMapCacheManager(
                RedisCacheConfig.PRODUCTS_ALL,
                RedisCacheConfig.PRODUCTS_SEARCH,
                RedisCacheConfig.PRODUCTS_SUGGEST,
                RedisCacheConfig.PRODUCTS_INVENTORY_HEALTH,
                RedisCacheConfig.ADMIN_DASHBOARD);
    }
}
