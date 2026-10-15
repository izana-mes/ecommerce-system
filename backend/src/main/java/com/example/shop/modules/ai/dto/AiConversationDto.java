package com.example.shop.modules.ai.dto;

import java.time.LocalDateTime;
import java.util.List;

public record AiConversationDto(String id, String audience, LocalDateTime updatedAt, List<AiConversationMessageDto> messages) {}
