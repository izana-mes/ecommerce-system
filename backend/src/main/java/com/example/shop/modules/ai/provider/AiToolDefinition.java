package com.example.shop.modules.ai.provider;

import java.util.Map;

/** Provider-neutral function declaration. The model only ever sees this allowlisted surface. */
public record AiToolDefinition(String name, String description, Map<String, Object> parameters) {}
