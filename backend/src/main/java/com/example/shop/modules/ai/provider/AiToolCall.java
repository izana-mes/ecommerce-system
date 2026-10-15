package com.example.shop.modules.ai.provider;

import java.util.Map;

public record AiToolCall(String id, String name, Map<String, Object> arguments) {}
