package com.example.shop.modules.chat.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TypingEvent {
    private String conversationId;
    private String userId;
    private String senderName;
    private Boolean typing;
    private String eventType; // typing_start, typing_stop
}
