package com.example.shop.common.audit;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.Map;

@Service
@RequiredArgsConstructor
@Slf4j
public class AdminAuditLogger {

    private final ObjectMapper objectMapper;

    public void log(String action, String actor, Map<String, Object> details) {
        String payload;
        try {
            payload = objectMapper.writeValueAsString(details);
        } catch (JsonProcessingException ex) {
            payload = "{\"serializationError\":true}";
        }
        log.info("audit event=admin_action action={} actor={} details={}", action, actor, payload);
    }
}
