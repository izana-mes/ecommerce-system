package com.example.shop.modules.security;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;

@Component
@RequiredArgsConstructor
@Slf4j
public class SecurityEventLogger {

    private final ObjectMapper objectMapper;

    public void info(String eventType, Map<String, Object> fields) {
        log.info("security_event {}", toJson(eventType, fields));
    }

    public void warn(String eventType, Map<String, Object> fields) {
        log.warn("security_event {}", toJson(eventType, fields));
    }

    private String toJson(String eventType, Map<String, Object> fields) {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("timestamp", Instant.now().toString());
        payload.put("eventType", eventType);
        if (fields != null) {
            payload.putAll(fields);
        }
        try {
            return objectMapper.writeValueAsString(payload);
        } catch (JsonProcessingException e) {
            return "{\"eventType\":\"" + eventType + "\",\"error\":\"serialization_failed\"}";
        }
    }
}
