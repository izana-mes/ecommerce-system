package com.example.shop.modules.messaging.outbox;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;

import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;

class MessageOutboxServiceTest {

    @Test
    void storesSerializedEventInTheSameDatabaseTransaction() {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        MessageOutboxService service = new MessageOutboxService(jdbc, new ObjectMapper());

        service.enqueue("order.created", "order.created", new EventPayload(42L, "ORD-42"));

        verify(jdbc).update(anyString(), eq("order.created"), eq("order.created"),
                eq("{\"orderId\":42,\"orderNumber\":\"ORD-42\"}"));
    }

    private record EventPayload(long orderId, String orderNumber) { }
}
