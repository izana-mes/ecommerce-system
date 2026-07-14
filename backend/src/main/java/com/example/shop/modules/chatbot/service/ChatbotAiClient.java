package com.example.shop.modules.chatbot.service;

import com.example.shop.common.observability.ObservabilityMetrics;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import io.micrometer.tracing.Span;
import io.micrometer.tracing.Tracer;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import java.util.*;

/**
 * OpenAI Responses-API client with MCP tool-calling loop.
 */
@Component
@Slf4j
public class ChatbotAiClient {

    private static final int MAX_TOOL_ROUNDS = 4;

    private static final String CUSTOMER_SYSTEM_PROMPT = """
            You are the AI customer assistant for an ecommerce store.
            Use tools for order/product facts. Do not invent status, prices, or stock.
            Keep answers concise and actionable.
            """;

    private static final String STAFF_SYSTEM_PROMPT = """
            You are the AI staff assistant for ecommerce operations.
            Use tool data for order, revenue, inventory, and product facts.
            Respond with operationally useful and concise bullet points.
            """;

    private final RestClient restClient;
    private final ObjectMapper objectMapper;

    private final boolean enabled;
    private final String apiKey;
    private final String model;
    private final String baseUrl;
    private final double temperature;
    private final int maxTokens;
    private final String mcpServerUrl;
    private final String mcpServiceToken;
    private final ObservabilityMetrics observabilityMetrics;
    private final Tracer tracer;

    public ChatbotAiClient(
            @Value("${application.chatbot.ai.enabled:false}") boolean enabled,
            @Value("${application.chatbot.ai.api-key:}") String apiKey,
            @Value("${application.chatbot.ai.model:gpt-4.1-mini}") String model,
            @Value("${application.chatbot.ai.base-url:https://api.openai.com/v1}") String baseUrl,
            @Value("${application.chatbot.ai.temperature:0.2}") double temperature,
            @Value("${application.chatbot.ai.max-tokens:600}") int maxTokens,
            @Value("${application.mcp.server-url:http://localhost:3100}") String mcpServerUrl,
            @Value("${application.mcp.service-token:}") String mcpServiceToken,
            ObjectMapper objectMapper,
            ObservabilityMetrics observabilityMetrics,
            Tracer tracer
    ) {
        this.enabled = enabled;
        this.apiKey = apiKey == null ? "" : apiKey.trim();
        this.model = model == null ? "" : model.trim();
        this.baseUrl = (baseUrl == null ? "" : baseUrl.trim()).replaceAll("/+$", "");
        this.temperature = temperature;
        this.maxTokens = maxTokens;
        this.mcpServerUrl = (mcpServerUrl == null ? "" : mcpServerUrl.trim()).replaceAll("/+$", "");
        this.mcpServiceToken = mcpServiceToken == null ? "" : mcpServiceToken.trim();
        this.objectMapper = objectMapper.copy().registerModule(new JavaTimeModule());
        this.observabilityMetrics = observabilityMetrics;
        this.tracer = tracer;
        this.restClient = RestClient.builder().build();
    }

    public Optional<String> generateCustomerAnswer(
            String question,
            String fallbackAnswer,
            String context,
            List<String> recentMessages,
            String customerEmail
    ) {
        if (!isReady()) return Optional.empty();
        try {
            String prompt = buildCustomerPrompt(question, context, fallbackAnswer, customerEmail, recentMessages);
            return runResponsesLoop(CUSTOMER_SYSTEM_PROMPT, prompt, buildToolSchemas(customerEmail), customerEmail);
        } catch (Exception ex) {
            log.warn("chatbot_customer_ai_error message={}", ex.getMessage());
            return Optional.empty();
        }
    }

    public Optional<String> generateStaffAnswer(String question, String context, List<String> recentMessages) {
        if (!isReady()) return Optional.empty();
        try {
            String prompt = buildStaffPrompt(question, context, recentMessages);
            return runResponsesLoop(STAFF_SYSTEM_PROMPT, prompt, buildToolSchemas(null), null);
        } catch (Exception ex) {
            log.warn("chatbot_staff_ai_error message={}", ex.getMessage());
            return Optional.empty();
        }
    }

    public Optional<String> generateCustomerAnswer(
            String question,
            String fallbackAnswer,
            String context,
            List<String> recentMessages
    ) {
        return generateCustomerAnswer(question, fallbackAnswer, context, recentMessages, null);
    }

    private boolean isReady() {
        return enabled && !apiKey.isBlank() && !model.isBlank() && !baseUrl.isBlank();
    }

    private Optional<String> runResponsesLoop(
            String systemPrompt,
            String userPrompt,
            List<Map<String, Object>> tools,
            String customerEmail
    ) {
        long startedAt = System.currentTimeMillis();
        String status = "success";
        observabilityMetrics.recordAiContextSize(model, userPrompt == null ? 0 : userPrompt.length());
        try {
            Map<String, Object> response = callResponses(null, List.of(
                    Map.of("role", "system", "content", systemPrompt),
                    Map.of("role", "user", "content", userPrompt)
            ), tools);
            if (response == null) {
                status = "empty_response";
                return Optional.empty();
            }
            recordTokenUsage(response);

            for (int round = 0; round < MAX_TOOL_ROUNDS; round++) {
                List<Map<String, Object>> toolCalls = extractFunctionCalls(response);
                if (toolCalls.isEmpty()) {
                    return extractOutputText(response);
                }

                List<Map<String, Object>> outputs = new ArrayList<>();
                for (Map<String, Object> call : toolCalls) {
                    String callId = String.valueOf(call.getOrDefault("call_id", ""));
                    String toolName = String.valueOf(call.getOrDefault("name", ""));
                    String argsJson = String.valueOf(call.getOrDefault("arguments", "{}"));
                    String toolResult = executeTool(toolName, argsJson, customerEmail);
                    outputs.add(Map.of(
                            "type", "function_call_output",
                            "call_id", callId,
                            "output", toolResult
                    ));
                }

                response = callResponses(String.valueOf(response.get("id")), outputs, tools);
                if (response == null) {
                    status = "empty_response";
                    return Optional.empty();
                }
                recordTokenUsage(response);
            }

            status = "max_rounds_reached";
            return extractOutputText(response);
        } catch (Exception ex) {
            status = "error";
            observabilityMetrics.recordAiModelError(model, "responses_loop_exception");
            throw ex;
        } finally {
            observabilityMetrics.recordAiRequest(model, status, System.currentTimeMillis() - startedAt);
        }
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> callResponses(String previousResponseId,
                                              List<Map<String, Object>> input,
                                              List<Map<String, Object>> tools) {
        try {
            Map<String, Object> body = new LinkedHashMap<>();
            body.put("model", model);
            body.put("input", input);
            body.put("temperature", temperature);
            body.put("max_output_tokens", maxTokens);
            if (previousResponseId != null && !previousResponseId.isBlank()) {
                body.put("previous_response_id", previousResponseId);
            }
            if (tools != null && !tools.isEmpty()) {
                body.put("tools", tools);
                body.put("tool_choice", "auto");
            }

            return restClient.post()
                    .uri(baseUrl + "/responses")
                    .header(HttpHeaders.AUTHORIZATION, "Bearer " + apiKey)
                    .header(HttpHeaders.CONTENT_TYPE, MediaType.APPLICATION_JSON_VALUE)
                    .header(HttpHeaders.ACCEPT, MediaType.APPLICATION_JSON_VALUE)
                    .body(body)
                    .retrieve()
                    .body(Map.class);
        } catch (Exception e) {
            log.warn("openai_responses_call_failed model={} error={}", model, e.getMessage());
            observabilityMetrics.recordAiModelError(model, "provider_call_failed");
            return null;
        }
    }

    @SuppressWarnings("unchecked")
    private List<Map<String, Object>> extractFunctionCalls(Map<String, Object> response) {
        Object out = response.get("output");
        if (!(out instanceof List<?> list)) return List.of();
        List<Map<String, Object>> calls = new ArrayList<>();
        for (Object item : list) {
            if (!(item instanceof Map<?, ?> m)) continue;
            Object type = m.get("type");
            if (!"function_call".equals(type)) continue;
            calls.add((Map<String, Object>) m);
        }
        return calls;
    }

    @SuppressWarnings("unchecked")
    private Optional<String> extractOutputText(Map<String, Object> response) {
        Object outputText = response.get("output_text");
        if (outputText instanceof String s && !s.isBlank()) return Optional.of(s.trim());

        Object out = response.get("output");
        if (!(out instanceof List<?> list)) return Optional.empty();

        StringBuilder sb = new StringBuilder();
        for (Object item : list) {
            if (!(item instanceof Map<?, ?> message)) continue;
            if (!"message".equals(String.valueOf(message.get("type")))) continue;
            Object content = message.get("content");
            if (!(content instanceof List<?> parts)) continue;
            for (Object part : parts) {
                if (!(part instanceof Map<?, ?> pm)) continue;
                if (!"output_text".equals(String.valueOf(pm.get("type")))) continue;
                Object txt = pm.get("text");
                if (txt instanceof String t && !t.isBlank()) {
                    if (!sb.isEmpty()) sb.append("\n");
                    sb.append(t.trim());
                }
            }
        }
        return sb.isEmpty() ? Optional.empty() : Optional.of(sb.toString());
    }

    @SuppressWarnings("unchecked")
    private String executeTool(String toolName, String argsJson, String customerEmail) {
        long startedAt = System.currentTimeMillis();
        Span span = tracer.nextSpan().name("ai.tool.execute:" + toolName).start();
        String metricStatus = "success";
        try {
            if (!allowedToolNames().contains(toolName)) {
                metricStatus = "hallucinated";
                observabilityMetrics.recordAiHallucinatedToolCall(toolName);
                return "{\"error\":\"Unknown tool requested by model\"}";
            }

            Map<String, Object> args = parseJson(argsJson);
            if (args == null) args = Map.of();

            if (customerEmail != null && !customerEmail.isBlank()) {
                args = new LinkedHashMap<>(args);
                args.put("email", customerEmail);
            }

            String mcpUrl = mcpServerUrl + "/tools/" + toolName;
            Map<String, Object> toolResponse = restClient.post()
                    .uri(mcpUrl)
                    .header(HttpHeaders.CONTENT_TYPE, MediaType.APPLICATION_JSON_VALUE)
                    .header("Authorization", "Bearer " + mcpServiceToken)
                    .body(args)
                    .retrieve()
                    .body(Map.class);

            return toolResponse == null ? "{\"error\":\"Tool returned no result\"}" : toJson(toolResponse);
        } catch (Exception e) {
            metricStatus = "failure";
            observabilityMetrics.recordAiModelError(model, "tool_execution_failed");
            log.warn("mcp_tool_execute_error tool={} error={}", toolName, e.getMessage());
            return "{\"error\":\"" + escapeJson(e.getMessage()) + "\"}";
        } finally {
            observabilityMetrics.recordAiToolExecution(toolName, metricStatus, System.currentTimeMillis() - startedAt);
            span.end();
        }
    }

    @SuppressWarnings("unchecked")
    private void recordTokenUsage(Map<String, Object> response) {
        Object usageObj = response.get("usage");
        if (!(usageObj instanceof Map<?, ?> usage)) {
            return;
        }
        recordUsageCounter(usage, "input_tokens", "input");
        recordUsageCounter(usage, "output_tokens", "output");
        recordUsageCounter(usage, "total_tokens", "total");
    }

    private void recordUsageCounter(Map<?, ?> usage, String key, String type) {
        Object value = usage.get(key);
        if (value instanceof Number number && number.doubleValue() > 0) {
            observabilityMetrics.recordAiTokens(model, type, number.doubleValue());
        }
    }

    private Set<String> allowedToolNames() {
        return Set.of(
                "getUserOrders",
                "getOrderDetail",
                "searchProducts",
                "recommendProducts",
                "cancelOrder",
                "createReturnRequest"
        );
    }

    private List<Map<String, Object>> buildToolSchemas(String customerEmail) {
        List<Map<String, Object>> tools = new ArrayList<>();

        if (customerEmail != null && !customerEmail.isBlank()) {
            tools.add(tool("getUserOrders", "Get recent orders for authenticated customer.",
                    Map.of("type", "object", "properties", Map.of(
                            "limit", Map.of("type", "integer", "minimum", 1, "maximum", 20)
                    ), "additionalProperties", false)));

            tools.add(tool("getOrderDetail", "Get detail for a specific order.",
                    Map.of("type", "object", "properties", Map.of(
                            "orderNumber", Map.of("type", "string")
                    ), "required", List.of("orderNumber"), "additionalProperties", false)));

            tools.add(tool("cancelOrder", "Cancel a pending order.",
                    Map.of("type", "object", "properties", Map.of(
                            "orderNumber", Map.of("type", "string")
                    ), "required", List.of("orderNumber"), "additionalProperties", false)));

            tools.add(tool("createReturnRequest", "Create return request for an order.",
                    Map.of("type", "object", "properties", Map.of(
                            "orderNumber", Map.of("type", "string"),
                            "reason", Map.of("type", "string", "minLength", 5)
                    ), "required", List.of("orderNumber", "reason"), "additionalProperties", false)));
        }

        tools.add(tool("searchProducts", "Search products with optional price filters.",
                Map.of("type", "object", "properties", Map.of(
                        "q", Map.of("type", "string"),
                        "minPrice", Map.of("type", "number"),
                        "maxPrice", Map.of("type", "number"),
                        "page", Map.of("type", "integer", "minimum", 0),
                        "size", Map.of("type", "integer", "minimum", 1, "maximum", 20)
                ), "additionalProperties", false)));

        tools.add(tool("recommendProducts", "Recommend in-stock products.",
                Map.of("type", "object", "properties", Map.of(), "additionalProperties", false)));

        return tools;
    }

    private Map<String, Object> tool(String name, String description, Map<String, Object> parameters) {
        return Map.of(
                "type", "function",
                "name", name,
                "description", description,
                "parameters", parameters
        );
    }

    private String buildCustomerPrompt(String question, String context, String fallbackAnswer, String customerEmail, List<String> recentMessages) {
        StringBuilder sb = new StringBuilder();
        if (recentMessages != null && !recentMessages.isEmpty()) {
            sb.append("Recent conversation:\n").append(String.join("\n", recentMessages)).append("\n\n");
        }
        sb.append("Customer question: ").append(question).append("\n\n");
        if (customerEmail != null && !customerEmail.isBlank()) {
            sb.append("Authenticated email: ").append(customerEmail).append("\n");
            sb.append("For order tools, use this email automatically.\n\n");
        } else {
            sb.append("Customer is not authenticated.\n\n");
        }
        sb.append("Context:\n").append(context).append("\n\n");
        sb.append("Deterministic fallback:\n").append(fallbackAnswer);
        return sb.toString();
    }

    private String buildStaffPrompt(String question, String context, List<String> recentMessages) {
        StringBuilder sb = new StringBuilder();
        if (recentMessages != null && !recentMessages.isEmpty()) {
            sb.append("Recent conversation:\n").append(String.join("\n", recentMessages)).append("\n\n");
        }
        sb.append("Staff question: ").append(question).append("\n\n");
        sb.append("Operational context:\n").append(context);
        return sb.toString();
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> parseJson(String json) {
        try {
            return objectMapper.readValue(json, Map.class);
        } catch (Exception e) {
            return null;
        }
    }

    private String toJson(Object obj) {
        try {
            return objectMapper.writeValueAsString(obj);
        } catch (Exception e) {
            return "{}";
        }
    }

    private String escapeJson(String value) {
        if (value == null) return "";
        return value.replace("\\", "\\\\").replace("\"", "\\\"");
    }
}
