package com.example.shop.config;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.RedisConnectionFailureException;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.List;

@Component
@RequiredArgsConstructor
@Slf4j
public class CacheInvalidationEventPublisher {

    private final StringRedisTemplate redisTemplate;
    private final ObjectMapper objectMapper;

    @Value("${application.cache.invalidation.channel:cache:invalidate:all}")
    private String channel;

    @Value("${application.cache.invalidation.node-id:${HOSTNAME:node-unknown}}")
    private String nodeId;

    public void publish(List<String> cacheNames) {
        if (cacheNames == null || cacheNames.isEmpty()) {
            return;
        }
        CacheInvalidationEvent event = new CacheInvalidationEvent(nodeId, cacheNames, Instant.now());
        try {
            redisTemplate.convertAndSend(channel, objectMapper.writeValueAsString(event));
        } catch (RedisConnectionFailureException | JsonProcessingException ex) {
            log.warn("Failed to publish cache invalidation event: {}", ex.getMessage());
        }
    }
}
