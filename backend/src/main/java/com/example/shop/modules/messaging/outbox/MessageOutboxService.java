package com.example.shop.modules.messaging.outbox;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class MessageOutboxService {

    private final JdbcTemplate jdbcTemplate;
    private final ObjectMapper objectMapper;

    @Transactional
    public void enqueue(String eventType, String routingKey, Object payload) {
        try {
            jdbcTemplate.update("""
                    INSERT INTO message_outbox (event_type, routing_key, payload)
                    VALUES (?, ?, ?)
                    """, eventType, routingKey, objectMapper.writeValueAsString(payload));
        } catch (JsonProcessingException ex) {
            throw new IllegalArgumentException("Unable to serialize outbox event " + eventType, ex);
        }
    }
}
