package com.example.shop.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.cache.Cache;
import org.springframework.cache.CacheManager;
import org.springframework.data.redis.connection.Message;
import org.springframework.data.redis.connection.MessageListener;
import org.springframework.stereotype.Component;

import java.nio.charset.StandardCharsets;
import java.util.List;

@Component
@RequiredArgsConstructor
@Slf4j
public class CacheInvalidationSubscriber implements MessageListener {

    private final ObjectMapper objectMapper;
    private final CacheManager cacheManager;

    @Value("${application.cache.invalidation.node-id:${HOSTNAME:node-unknown}}")
    private String nodeId;

    @Override
    public void onMessage(Message message, byte[] pattern) {
        String body = new String(message.getBody(), StandardCharsets.UTF_8);
        try {
            CacheInvalidationEvent event = objectMapper.readValue(body, CacheInvalidationEvent.class);
            if (event == null || event.cacheNames() == null || event.cacheNames().isEmpty()) {
                return;
            }
            if (nodeId.equals(event.sourceNodeId())) {
                return;
            }
            clearCaches(event.cacheNames());
        } catch (Exception ex) {
            log.warn("Failed to consume cache invalidation event: {}", ex.getMessage());
        }
    }

    private void clearCaches(List<String> cacheNames) {
        for (String cacheName : cacheNames) {
            try {
                Cache cache = cacheManager.getCache(cacheName);
                if (cache != null) {
                    cache.clear();
                }
            } catch (Exception ex) {
                log.warn("Failed to clear cache {} from invalidation event: {}", cacheName, ex.getMessage());
            }
        }
    }
}
