package com.example.shop.modules.messaging.outbox;

import com.example.shop.config.ConditionalOnRabbitEnabled;
import com.example.shop.modules.messaging.order.OrderCreatedEvent;
import com.example.shop.modules.messaging.order.OrderStatusChangedEvent;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.amqp.core.MessageDeliveryMode;
import org.springframework.amqp.rabbit.connection.CorrelationData;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.UUID;

@Component
@ConditionalOnRabbitEnabled
@RequiredArgsConstructor
@Slf4j
public class MessageOutboxDispatcher {

    private final JdbcTemplate jdbcTemplate;
    private final RabbitTemplate rabbitTemplate;
    private final ObjectMapper objectMapper;

    @Value("${application.messaging.exchange}")
    private String exchange;

    @Value("${application.messaging.outbox.batch-size:50}")
    private int batchSize;

    @Scheduled(fixedDelayString = "${application.messaging.outbox.fixed-delay-ms:1000}")
    public void dispatchPending() {
        List<Long> ids = jdbcTemplate.queryForList("""
                SELECT id FROM message_outbox
                WHERE published_at IS NULL AND (locked_until IS NULL OR locked_until < CURRENT_TIMESTAMP)
                ORDER BY id
                LIMIT ?
                """, Long.class, Math.max(1, Math.min(batchSize, 200)));
        for (Long id : ids) {
            dispatchOne(id);
        }
    }

    private void dispatchOne(Long id) {
        OutboxRow row = claim(id);
        if (row == null) {
            return;
        }
        try {
            CorrelationData correlation = new CorrelationData("outbox-" + row.id() + "-" + UUID.randomUUID());
            rabbitTemplate.convertAndSend(exchange, row.routingKey(), decode(row), message -> {
                message.getMessageProperties().setDeliveryMode(MessageDeliveryMode.PERSISTENT);
                message.getMessageProperties().setMessageId("outbox-" + row.id());
                message.getMessageProperties().setHeader("eventType", row.eventType());
                return message;
            }, correlation);
            CorrelationData.Confirm confirm = correlation.getFuture().get(10, java.util.concurrent.TimeUnit.SECONDS);
            if (confirm == null || !confirm.isAck()) {
                throw new IllegalStateException("Broker did not confirm message: " + (confirm == null ? "timeout" : confirm.getReason()));
            }
            jdbcTemplate.update("UPDATE message_outbox SET published_at = CURRENT_TIMESTAMP, locked_until = NULL, last_error = NULL WHERE id = ?", row.id());
        } catch (Exception ex) {
            jdbcTemplate.update("""
                    UPDATE message_outbox
                    SET locked_until = NULL, attempts = attempts + 1, last_error = ?
                    WHERE id = ?
                    """, abbreviate(ex.getMessage()), row.id());
            log.warn("Outbox publish failed for id {} (will retry): {}", row.id(), ex.getMessage());
        }
    }

    protected OutboxRow claim(Long id) {
        int updated = jdbcTemplate.update("""
                UPDATE message_outbox SET locked_until = CURRENT_TIMESTAMP + INTERVAL '30 seconds'
                WHERE id = ? AND published_at IS NULL
                  AND (locked_until IS NULL OR locked_until < CURRENT_TIMESTAMP)
                """, id);
        if (updated == 0) {
            return null;
        }
        return jdbcTemplate.queryForObject("SELECT id, event_type, routing_key, payload FROM message_outbox WHERE id = ?",
                (rs, ignored) -> new OutboxRow(rs.getLong(1), rs.getString(2), rs.getString(3), rs.getString(4)), id);
    }

    private String abbreviate(String value) {
        if (value == null) return "unknown failure";
        return value.length() <= 2000 ? value : value.substring(0, 2000);
    }

    /**
     * For unknown event types the raw JSON payload is sent as a pre-serialised string.
     * The Jackson message converter will wrap it in a plain text body which consumers
     * that know the concrete type can deserialise from the message payload directly.
     * Known types are fully deserialised so the converter produces a typed JSON body.
     */
    private Object decode(OutboxRow row) throws Exception {
        return switch (row.eventType()) {
            case "order.created" -> objectMapper.readValue(row.payload(), OrderCreatedEvent.class);
            case "order.status.changed" -> objectMapper.readValue(row.payload(), OrderStatusChangedEvent.class);
            // Generic path: send the raw JSON payload as an already-serialised string.
            // The RabbitTemplate's Jackson converter will re-serialise it, so consumers
            // receive a valid JSON object body regardless.
            default -> objectMapper.readTree(row.payload());
        };
    }

    private record OutboxRow(long id, String eventType, String routingKey, String payload) { }
}
