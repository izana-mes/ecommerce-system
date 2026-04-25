package com.example.shop.modules.supportchat.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class SupportChatResponseDto {
    private String conversationId;
    private List<ChatMessageDto> messages;
    private String error;
}
