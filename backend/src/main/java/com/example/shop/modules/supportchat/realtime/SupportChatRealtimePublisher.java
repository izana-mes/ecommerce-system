package com.example.shop.modules.supportchat.realtime;

import com.example.shop.modules.supportchat.dto.ConversationSummaryDto;
import com.example.shop.modules.supportchat.dto.SupportChatResponseDto;
import lombok.RequiredArgsConstructor;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class SupportChatRealtimePublisher {

    private final SimpMessagingTemplate messagingTemplate;

    public void publishConversationSnapshot(SupportChatResponseDto response) {
        if (response == null || response.getConversationId() == null || response.getConversationId().isBlank()) {
            return;
        }
        messagingTemplate.convertAndSend("/topic/support-chat/conversations/" + response.getConversationId(), response);
    }

    public void publishStaffConversationUpdate(ConversationSummaryDto conversation) {
        if (conversation == null || conversation.getConversationId() == null || conversation.getConversationId().isBlank()) {
            return;
        }
        messagingTemplate.convertAndSend("/topic/support-chat/staff/conversations", conversation);
    }
}
