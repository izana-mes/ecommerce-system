package com.example.shop.modules.ai.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record AiChatRequest(@NotBlank @Size(max = 2000) String message, @Size(max = 80) String productId,
                            @Size(max = 80) String conversationId) {}
