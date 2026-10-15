package com.example.shop.modules.ai.dto;

import java.time.LocalDateTime;

public record AiConversationMessageDto(String id, String role, String content, LocalDateTime createdAt) {}
