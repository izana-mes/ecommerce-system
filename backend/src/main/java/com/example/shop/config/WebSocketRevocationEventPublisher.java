package com.example.shop.config;

import com.example.shop.modules.security.SecurityEventLogger;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.RedisConnectionFailureException;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.Map;

@Component
@RequiredArgsConstructor
public class WebSocketRevocationEventPublisher {

    private final StringRedisTemplate redisTemplate;
    private final ObjectMapper objectMapper;
    private final SecurityEventLogger securityEventLogger;

    @Value("${application.security.websocket.node-id:${HOSTNAME:node-unknown}}")
    private String nodeId;

    public void publish(String scope, String value, String reason, String requestId) {
        if (scope == null || value == null || value.isBlank()) return;
        String channel = "auth:revoke:" + scope + ":" + value;
        WebSocketRevocationEvent event = new WebSocketRevocationEvent(
                scope,
                value,
                reason,
                requestId,
                nodeId,
                Instant.now()
        );
        try {
            redisTemplate.convertAndSend(channel, objectMapper.writeValueAsString(event));
            securityEventLogger.warn("websocket_revoke_published", Map.of(
                    "channel", channel,
                    "scope", scope,
                    "value", value,
                    "reason", safe(reason),
                    "requestId", safe(requestId),
                    "nodeId", safe(nodeId)
            ));
        } catch (RedisConnectionFailureException | JsonProcessingException ex) {
            securityEventLogger.warn("websocket_revoke_publish_failed", Map.of(
                    "channel", channel,
                    "scope", scope,
                    "value", value,
                    "reason", safe(reason),
                    "requestId", safe(requestId),
                    "nodeId", safe(nodeId),
                    "errorType", ex.getClass().getSimpleName()
            ));
        }
    }

    private String safe(String value) {
        return value == null ? "" : value;
    }
}
