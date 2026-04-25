package com.example.shop.modules.supportchat.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ChatMessageDto {
    private String messageId;
    private String conversationId;
    private String senderRole;
    private String senderEmail;
    private String body;
    private String createdAt;
}
