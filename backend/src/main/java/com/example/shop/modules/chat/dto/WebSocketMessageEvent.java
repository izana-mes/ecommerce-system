package com.example.shop.modules.chat.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class WebSocketMessageEvent {
    private String eventType; // NEW_MESSAGE, EDIT_MESSAGE, DELETE_MESSAGE, REACTION_UPDATE, READ_UPDATE, CONVERSATION_UPDATE
    private String conversationId;
    private MessageDto message;
    private String messageId;
    private String userId;
    private ConversationDto conversation;
}
