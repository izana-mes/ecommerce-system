package com.example.shop.modules.chat.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CreateConversationRequest {
    @NotBlank(message = "Conversation type is required")
    private String type; // direct, group, support, order
    private String title;
    private String targetUserId; // for direct conversations
    private List<String> memberIds; // for group conversations
    private String initialMessage;
}
