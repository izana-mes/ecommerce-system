package com.example.shop.config;

import com.example.shop.modules.security.SecurityEventLogger;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.event.EventListener;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.messaging.SessionDisconnectEvent;

import java.util.Map;

@Component
@RequiredArgsConstructor
public class WebSocketSessionLifecycleListener {

    private final WebSocketSessionRegistry webSocketSessionRegistry;
    private final SecurityEventLogger securityEventLogger;

    @Value("${application.security.websocket.node-id:${HOSTNAME:node-unknown}}")
    private String nodeId;

    @EventListener
    public void onDisconnect(SessionDisconnectEvent event) {
        String sessionId = event.getSessionId();
        webSocketSessionRegistry.unregister(sessionId);
        StompHeaderAccessor accessor = StompHeaderAccessor.wrap(event.getMessage());
        securityEventLogger.info("websocket_disconnect", Map.of(
                "wsSessionId", sessionId == null ? "" : sessionId,
                "closeStatus", event.getCloseStatus() == null ? "" : event.getCloseStatus().toString(),
                "receipt", accessor.getReceipt() == null ? "" : accessor.getReceipt(),
                "nodeId", nodeId == null ? "" : nodeId
        ));
    }
}
