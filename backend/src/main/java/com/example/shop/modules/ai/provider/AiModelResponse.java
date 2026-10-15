package com.example.shop.modules.ai.provider;

import java.util.List;

public record AiModelResponse(String text, List<AiToolCall> toolCalls) {}
