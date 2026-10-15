package com.example.shop.modules.ai.provider;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import java.util.*;

@Component
public class GeminiAiProvider implements AiProvider {
    private final String key, model;
    private final ObjectMapper mapper;
    private final RestClient client;

    public GeminiAiProvider(@Value("${application.ai.gemini-api-key:}") String key, @Value("${application.ai.gemini-model:gemini-2.0-flash}") String model, ObjectMapper mapper) {
        this.key = key.trim();
        this.model = model;
        this.mapper = mapper;
        org.springframework.http.client.SimpleClientHttpRequestFactory factory = new org.springframework.http.client.SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(java.time.Duration.ofSeconds(10));
        factory.setReadTimeout(java.time.Duration.ofSeconds(25));
        this.client = RestClient.builder().requestFactory(factory).build();
    }
    public String name(){ return "gemini"; }
    public AiModelResponse chat(String system, List<Map<String,Object>> messages, List<AiToolDefinition> tools) {
        if (key.isBlank()) throw new AiProviderException("Gemini is not configured", true);
        try {
            List<Map<String,Object>> contents=new ArrayList<>();
            for(Map<String,Object> m:messages){ String role=String.valueOf(m.getOrDefault("role","user")); if("tool".equals(role)){contents.add(Map.of("role","function","parts",List.of(Map.of("functionResponse",Map.of("name",m.get("name"),"response",Map.of("result",m.get("content")))))));}else contents.add(Map.of("role","assistant".equals(role)?"model":"user","parts",List.of(Map.of("text",String.valueOf(m.get("content")))))); }
            List<Map<String,Object>> declarations=tools.stream().<Map<String,Object>>map(t->Map.of("name",t.name(),"description",t.description(),"parameters",t.parameters())).toList();
            Map<String,Object> body=new LinkedHashMap<>(); body.put("system_instruction",Map.of("parts",List.of(Map.of("text",system)))); body.put("contents",contents); body.put("generationConfig",Map.of("temperature",0.2,"maxOutputTokens",900)); if(!declarations.isEmpty())body.put("tools",List.of(Map.of("functionDeclarations",declarations)));
            String raw=client.post().uri("https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={key}",model,key).contentType(MediaType.APPLICATION_JSON).body(body).retrieve().body(String.class);
            JsonNode root=mapper.readTree(raw); JsonNode parts=root.at("/candidates/0/content/parts"); List<AiToolCall> calls=new ArrayList<>(); StringBuilder text=new StringBuilder();
            for(JsonNode part:parts){if(part.has("text"))text.append(part.path("text").asText()); JsonNode fn=part.path("functionCall");if(!fn.isMissingNode())calls.add(new AiToolCall(UUID.randomUUID().toString(),fn.path("name").asText(),mapper.convertValue(fn.path("args"),Map.class)));}
            if(text.isEmpty()&&calls.isEmpty())throw new AiProviderException("Gemini returned no usable answer",true); return new AiModelResponse(text.toString(),calls);
        } catch (AiProviderException e) { throw e; } catch (Exception e) { throw new AiProviderException("Gemini temporarily unavailable", true); }
    }
}
