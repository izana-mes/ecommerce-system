package com.example.shop.modules.ai.dto;

import java.util.List;

public record AiChatResponse(String message, List<AiProductDto> products, List<String> insights,
                             String provider, List<String> toolsUsed, String conversationId) {}
