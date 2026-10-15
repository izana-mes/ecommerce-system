package com.example.shop.modules.chat.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class WebSocketStompRequest {
    private String conversationId;
    private String body;
    private String replyToMessageId;
    private String reaction;
    private String eventType; // TYPING_START, TYPING_STOP, READ
}
