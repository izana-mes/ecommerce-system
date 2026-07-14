package com.example.shop.modules.workspace.realtime;

import lombok.RequiredArgsConstructor;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

import java.util.Map;

@Component
@RequiredArgsConstructor
public class WorkspaceRealtimePublisher {

    private final SimpMessagingTemplate messagingTemplate;

    public void publishNotificationChanged(String recipient, Map<String, Object> payload) {
        if (!StringUtils.hasText(recipient) || payload == null || payload.isEmpty()) {
            return;
        }
        messagingTemplate.convertAndSend("/topic/workspace/notifications/" + recipient.trim().toLowerCase(), payload);
    }
}
