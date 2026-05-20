package com.example.shop.config;

import com.example.shop.modules.security.SecurityEventLogger;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.connection.Message;
import org.springframework.data.redis.connection.MessageListener;
import org.springframework.stereotype.Component;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Map;

@Component
@RequiredArgsConstructor
public class WebSocketRevocationSubscriber implements MessageListener {

    private final ObjectMapper objectMapper;
    private final WebSocketSessionRegistry sessionRegistry;
    private final SecurityEventLogger securityEventLogger;

    @Value("${application.security.websocket.node-id:${HOSTNAME:node-unknown}}")
    private String nodeId;

    @Override
    public void onMessage(Message message, byte[] pattern) {
        String channel = new String(message.getChannel(), StandardCharsets.UTF_8);
        String body = new String(message.getBody(), StandardCharsets.UTF_8);
        try {
            WebSocketRevocationEvent event = objectMapper.readValue(body, WebSocketRevocationEvent.class);
            int disconnected = switch (event.scope()) {
                case "jti" -> sessionRegistry.forceDisconnectByJti(event.value(), event.reason(), event.requestId(), event.sourceNodeId());
                case "session" -> sessionRegistry.forceDisconnectBySession(event.value(), event.reason(), event.requestId(), event.sourceNodeId());
                case "family" -> sessionRegistry.forceDisconnectByFamily(event.value(), event.reason(), event.requestId(), event.sourceNodeId());
                case "user" -> sessionRegistry.forceDisconnectByUser(event.value(), event.reason(), event.requestId(), event.sourceNodeId());
                default -> 0;
            };
            securityEventLogger.warn("websocket_revoke_consumed", Map.of(
                    "channel", channel,
                    "scope", safe(event.scope()),
                    "value", safe(event.value()),
                    "reason", safe(event.reason()),
                    "requestId", safe(event.requestId()),
                    "sourceNodeId", safe(event.sourceNodeId()),
                    "nodeId", safe(nodeId),
                    "disconnected", disconnected,
                    "occurredAt", event.occurredAt() == null ? Instant.now().toString() : event.occurredAt().toString()
            ));
        } catch (Exception ex) {
            securityEventLogger.warn("websocket_revoke_consume_failed", Map.of(
                    "channel", channel,
                    "nodeId", safe(nodeId),
                    "errorType", ex.getClass().getSimpleName()
            ));
        }
    }

    private String safe(String value) {
        return value == null ? "" : value;
    }
}
