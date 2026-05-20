package com.example.shop.config;

import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.WebSocketHandler;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.WebSocketHandlerDecorator;

public class WebSocketTrackingDecorator extends WebSocketHandlerDecorator {

    private final WebSocketSessionRegistry sessionRegistry;

    public WebSocketTrackingDecorator(WebSocketHandler delegate, WebSocketSessionRegistry sessionRegistry) {
        super(delegate);
        this.sessionRegistry = sessionRegistry;
    }

    @Override
    public void afterConnectionEstablished(WebSocketSession session) throws Exception {
        sessionRegistry.registerTransportSession(session);
        super.afterConnectionEstablished(session);
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus closeStatus) throws Exception {
        try {
            super.afterConnectionClosed(session, closeStatus);
        } finally {
            sessionRegistry.unregister(session.getId());
        }
    }

    @Override
    public void handleTransportError(WebSocketSession session, Throwable exception) throws Exception {
        try {
            super.handleTransportError(session, exception);
        } finally {
            if (session != null && !session.isOpen()) {
                sessionRegistry.unregister(session.getId());
            }
        }
    }
}
