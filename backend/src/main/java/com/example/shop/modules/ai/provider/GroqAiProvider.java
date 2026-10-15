package com.example.shop.modules.ai.provider;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import java.util.*;

@Component
public class GroqAiProvider implements AiProvider {
    private final String key, model, baseUrl; private final ObjectMapper mapper; private final RestClient client=RestClient.builder().build();
    public GroqAiProvider(@Value("${application.ai.groq-api-key:${CHATBOT_AI_API_KEY:}}") String key, @Value("${application.ai.groq-model:${CHATBOT_AI_MODEL:llama-3.3-70b-versatile}}") String model, @Value("${application.ai.groq-base-url:${CHATBOT_AI_BASE_URL:https://api.groq.com/openai/v1}}") String baseUrl, ObjectMapper mapper) {this.key=key.trim();this.model=model;this.baseUrl=baseUrl.replaceAll("/+$","");this.mapper=mapper;}
    public String name(){return "groq";}
    public AiModelResponse chat(String system,List<Map<String,Object>> messages,List<AiToolDefinition> tools){
        if(key.isBlank()) throw new AiProviderException("Groq is not configured",true);
        try { List<Map<String,Object>> prompt=new ArrayList<>();prompt.add(Map.of("role","system","content",system));prompt.addAll(messages); List<Map<String,Object>> toolDefs=tools.stream().<Map<String,Object>>map(t->Map.of("type","function","function",Map.of("name",t.name(),"description",t.description(),"parameters",t.parameters()))).toList(); Map<String,Object> body=new LinkedHashMap<>();body.put("model",model);body.put("temperature",0.2);body.put("max_tokens",900);body.put("messages",prompt);if(!toolDefs.isEmpty())body.put("tools",toolDefs);
            String raw=client.post().uri(baseUrl+"/chat/completions").header("Authorization","Bearer "+key).contentType(MediaType.APPLICATION_JSON).body(body).retrieve().body(String.class);
            JsonNode message=mapper.readTree(raw).at("/choices/0/message"); List<AiToolCall> calls=new ArrayList<>();for(JsonNode call:message.path("tool_calls")){calls.add(new AiToolCall(call.path("id").asText(),call.at("/function/name").asText(),mapper.readValue(call.at("/function/arguments").asText("{}"),Map.class)));}return new AiModelResponse(message.path("content").asText(""),calls);
        } catch(AiProviderException e){throw e;} catch(Exception e){throw new AiProviderException("Groq temporarily unavailable",true);}
    }
}
