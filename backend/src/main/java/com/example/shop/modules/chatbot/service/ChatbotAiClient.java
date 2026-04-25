package com.example.shop.modules.chatbot.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@Component
@Slf4j
public class ChatbotAiClient {

    private final RestClient restClient;
    private final boolean enabled;
    private final String apiKey;
    private final String model;
    private final String baseUrl;
    private final String referer;
    private final String appName;
    private final double temperature;
    private final int maxTokens;

    public ChatbotAiClient(
            @Value("${application.chatbot.ai.enabled:false}") boolean enabled,
            @Value("${application.chatbot.ai.api-key:}") String apiKey,
            @Value("${application.chatbot.ai.model:google/gemma-3-4b-it:free}") String model,
            @Value("${application.chatbot.ai.base-url:https://openrouter.ai/api/v1}") String baseUrl,
            @Value("${application.chatbot.ai.referer:}") String referer,
            @Value("${application.chatbot.ai.app-name:shop-chatbot}") String appName,
            @Value("${application.chatbot.ai.temperature:0.2}") double temperature,
            @Value("${application.chatbot.ai.max-tokens:300}") int maxTokens
    ) {
        this.enabled = enabled;
        this.apiKey = apiKey == null ? "" : apiKey.trim();
        this.model = model == null ? "" : model.trim();
        this.baseUrl = (baseUrl == null ? "" : baseUrl.trim()).replaceAll("/+$", "");
        this.referer = referer == null ? "" : referer.trim();
        this.appName = appName == null ? "shop-chatbot" : appName.trim();
        this.temperature = temperature;
        this.maxTokens = maxTokens;
        this.restClient = RestClient.builder().build();
    }

    public Optional<String> generateCustomerAnswer(String question, String fallbackAnswer, String context, List<String> recentMessages) {
        if (!enabled || apiKey.isBlank() || model.isBlank() || baseUrl.isBlank()) {
            return Optional.empty();
        }

        List<Map<String, Object>> messages = new ArrayList<>();
        messages.add(Map.of(
                "role", "system",
                "content", """
                        You are the customer support AI for an ecommerce store.
                        Answer only from the provided store context and recent conversation.
                        Do not invent policies, prices, order statuses, or stock values.
                        If the context is incomplete, say what is missing and give the safest next step.
                        Keep answers concise, practical, and customer-friendly.
                        """
        ));

        if (!recentMessages.isEmpty()) {
            messages.add(Map.of(
                    "role", "system",
                    "content", "Recent conversation:\n" + String.join("\n", recentMessages)
            ));
        }

        messages.add(Map.of(
                "role", "user",
                "content", "Customer question:\n" + question + "\n\nStore context:\n" + context +
                        "\n\nFallback deterministic answer:\n" + fallbackAnswer
        ));

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("model", model);
        body.put("messages", messages);
        body.put("temperature", temperature);
        body.put("max_tokens", maxTokens);

        try {
            @SuppressWarnings("unchecked")
            Map<String, Object> response = restClient.post()
                    .uri(baseUrl + "/chat/completions")
                    .header(HttpHeaders.AUTHORIZATION, "Bearer " + apiKey)
                    .header(HttpHeaders.CONTENT_TYPE, MediaType.APPLICATION_JSON_VALUE)
                    .header(HttpHeaders.ACCEPT, MediaType.APPLICATION_JSON_VALUE)
                    .headers(headers -> {
                        if (!referer.isBlank()) {
                            headers.add("HTTP-Referer", referer);
                        }
                        headers.add("X-Title", appName);
                    })
                    .body(body)
                    .retrieve()
                    .body(Map.class);

            return extractContent(response);
        } catch (Exception ex) {
            log.warn("Customer chatbot AI call failed: {}", ex.getMessage());
            return Optional.empty();
        }
    }

    @SuppressWarnings("unchecked")
    private Optional<String> extractContent(Map<String, Object> response) {
        if (response == null) {
            return Optional.empty();
        }

        Object choicesObj = response.get("choices");
        if (!(choicesObj instanceof List<?> choices) || choices.isEmpty()) {
            return Optional.empty();
        }

        Object firstChoice = choices.get(0);
        if (!(firstChoice instanceof Map<?, ?> choiceMap)) {
            return Optional.empty();
        }

        Object messageObj = choiceMap.get("message");
        if (!(messageObj instanceof Map<?, ?> messageMap)) {
            return Optional.empty();
        }

        Object contentObj = messageMap.get("content");
        if (contentObj instanceof String content && !content.isBlank()) {
            return Optional.of(content.trim());
        }
        if (contentObj instanceof List<?> contentParts) {
            StringBuilder merged = new StringBuilder();
            for (Object part : contentParts) {
                if (part instanceof Map<?, ?> partMap) {
                    Object text = partMap.get("text");
                    if (text instanceof String textValue && !textValue.isBlank()) {
                        if (merged.length() > 0) {
                            merged.append('\n');
                        }
                        merged.append(textValue.trim());
                    }
                }
            }
            if (!merged.isEmpty()) {
                return Optional.of(merged.toString());
            }
        }

        return Optional.empty();
    }
}
