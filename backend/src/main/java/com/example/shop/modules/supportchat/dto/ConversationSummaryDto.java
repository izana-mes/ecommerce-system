package com.example.shop.modules.supportchat.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ConversationSummaryDto {
    private String conversationId;
    private String customerLabel;
    private String status;
    private String lastMessageAt;
    private String lastMessagePreview;
}
