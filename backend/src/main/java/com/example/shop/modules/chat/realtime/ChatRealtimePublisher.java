package com.example.shop.modules.chat.realtime;

import com.example.shop.modules.chat.dto.ConversationDto;
import com.example.shop.modules.chat.dto.MessageDto;
import com.example.shop.modules.chat.dto.ReactionSummaryDto;
import com.example.shop.modules.chat.dto.TypingEvent;
import com.example.shop.modules.chat.dto.WebSocketMessageEvent;
import lombok.RequiredArgsConstructor;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Component;

import java.util.List;

@Component
@RequiredArgsConstructor
public class ChatRealtimePublisher {

    private final SimpMessagingTemplate messagingTemplate;

    public void publishNewMessage(String conversationId, MessageDto message) {
        messagingTemplate.convertAndSend("/topic/chat/conversations/" + conversationId + "/messages",
                WebSocketMessageEvent.builder()
                        .eventType("NEW_MESSAGE")
                        .conversationId(conversationId)
                        .message(message)
                        .build());
    }

    public void publishEditMessage(String conversationId, MessageDto message) {
        messagingTemplate.convertAndSend("/topic/chat/conversations/" + conversationId + "/messages",
                WebSocketMessageEvent.builder()
                        .eventType("EDIT_MESSAGE")
                        .conversationId(conversationId)
                        .message(message)
                        .build());
    }

    public void publishDeleteMessage(String conversationId, String messageId) {
        messagingTemplate.convertAndSend("/topic/chat/conversations/" + conversationId + "/messages",
                WebSocketMessageEvent.builder()
                        .eventType("DELETE_MESSAGE")
                        .conversationId(conversationId)
                        .messageId(messageId)
                        .build());
    }

    public void publishReactionUpdate(
            String conversationId,
            String messageId,
            String actorUserId,
            String actorReaction,
            List<ReactionSummaryDto> reactions) {
        messagingTemplate.convertAndSend("/topic/chat/conversations/" + conversationId + "/messages",
                WebSocketMessageEvent.builder()
                        .eventType("REACTION_UPDATE")
                        .conversationId(conversationId)
                        .messageId(messageId)
                        .userId(actorUserId)
                        .message(MessageDto.builder()
                                .messageId(messageId)
                                .reactions(reactions)
                                .myReaction(actorReaction)
                                .build())
                        .build());
    }

    public void publishReadUpdate(String conversationId, String userId) {
        messagingTemplate.convertAndSend("/topic/chat/conversations/" + conversationId + "/messages",
                WebSocketMessageEvent.builder()
                        .eventType("READ_UPDATE")
                        .conversationId(conversationId)
                        .userId(userId)
                        .build());
    }

    public void publishTyping(String conversationId, String userId, String senderName, boolean typing) {
        TypingEvent event = TypingEvent.builder()
                .conversationId(conversationId)
                .userId(userId)
                .senderName(senderName)
                .typing(typing)
                .eventType(typing ? "typing_start" : "typing_stop")
                .build();
        messagingTemplate.convertAndSend("/topic/chat/conversations/" + conversationId + "/typing", event);
    }

    public void publishConversationUpdate(String userId, ConversationDto conversation) {
        messagingTemplate.convertAndSend("/topic/chat/users/" + userId + "/conversations",
                WebSocketMessageEvent.builder()
                        .eventType("CONVERSATION_UPDATE")
                        .conversationId(conversation.getConversationId())
                        .conversation(conversation)
                        .build());
    }
}
