package com.example.shop.modules.messaging.audit;

import com.example.shop.config.ConditionalOnRabbitEnabled;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import java.sql.Timestamp;

@Component
@RequiredArgsConstructor
@ConditionalOnRabbitEnabled
@Slf4j
public class AuditEventConsumer {

    private final JdbcTemplate jdbcTemplate;
    private final ObjectMapper objectMapper;

    @RabbitListener(queues = "${application.messaging.queue.audit-event}")
    public void consume(AuditEvent event) {
        if (event == null) {
            log.warn("Received null audit event");
            return;
        }

        try {
            String detailsJson = "{}";
            if (event.getDetails() != null && !event.getDetails().isEmpty()) {
                try {
                    detailsJson = objectMapper.writeValueAsString(event.getDetails());
                } catch (JsonProcessingException e) {
                    log.warn("Failed to serialize audit event details", e);
                }
            }

            jdbcTemplate.update(
                    """
                    INSERT INTO audit_events (event_type, entity_type, entity_id, actor, details, created_at)
                    VALUES (?, ?, ?, ?, ?::jsonb, ?)
                    """,
                    safe(event.getEventType()),
                    safe(event.getEntityType()),
                    safe(event.getEntityId()),
                    safe(event.getActor()),
                    detailsJson,
                    event.getCreatedAt() != null
                            ? Timestamp.valueOf(event.getCreatedAt())
                            : new Timestamp(System.currentTimeMillis())
            );

            log.debug("Audit event persisted: type={} entity={}/{}",
                    event.getEventType(), event.getEntityType(), event.getEntityId());
        } catch (Exception e) {
            log.error("Failed to persist audit event", e);
            throw e;
        }
    }

    private String safe(String value) {
        return value == null ? "" : value.trim();
    }
}
