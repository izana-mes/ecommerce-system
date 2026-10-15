package com.example.shop.modules.ai.provider;

/** Provider boundary: orchestration never exposes credentials or database access to a model. */
public interface AiProvider {
    String name();
    AiModelResponse chat(String systemInstruction, java.util.List<java.util.Map<String, Object>> messages,
                         java.util.List<AiToolDefinition> tools) throws AiProviderException;
}
