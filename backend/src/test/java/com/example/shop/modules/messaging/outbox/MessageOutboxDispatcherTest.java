package com.example.shop.modules.messaging.outbox;

import com.example.shop.modules.messaging.order.OrderCreatedEvent;
import com.example.shop.modules.messaging.order.OrderStatusChangedEvent;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.amqp.core.Message;
import org.springframework.amqp.core.MessagePostProcessor;
import org.springframework.amqp.rabbit.connection.CorrelationData;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.List;
import java.util.concurrent.CompletableFuture;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class MessageOutboxDispatcherTest {

    private JdbcTemplate jdbcTemplate;
    private RabbitTemplate rabbitTemplate;
    private ObjectMapper objectMapper;
    private MessageOutboxDispatcher dispatcher;

    @BeforeEach
    void setUp() {
        jdbcTemplate = mock(JdbcTemplate.class);
        rabbitTemplate = mock(RabbitTemplate.class);
        objectMapper = new ObjectMapper();
        dispatcher = new MessageOutboxDispatcher(jdbcTemplate, rabbitTemplate, objectMapper);
        ReflectionTestUtils.setField(dispatcher, "exchange", "shop.events");
        ReflectionTestUtils.setField(dispatcher, "batchSize", 50);
    }

    @Test
    void dispatchesOrderCreatedEventSuccessfully() {
        when(jdbcTemplate.queryForList(anyString(), eq(Long.class), eq(50)))
                .thenReturn(List.of(1L));

        when(jdbcTemplate.update(contains("UPDATE message_outbox SET locked_until"), eq(1L)))
                .thenReturn(1);

        String payload = "{\"orderId\":100,\"orderNumber\":\"ORD-100\",\"customerEmail\":\"c@example.com\"}";
        when(jdbcTemplate.queryForObject(contains("SELECT id, event_type"), any(RowMapper.class), eq(1L)))
                .thenAnswer(invocation -> {
                    RowMapper<?> mapper = invocation.getArgument(1);
                    var rs = mock(java.sql.ResultSet.class);
                    when(rs.getLong(1)).thenReturn(1L);
                    when(rs.getString(2)).thenReturn("order.created");
                    when(rs.getString(3)).thenReturn("order.created");
                    when(rs.getString(4)).thenReturn(payload);
                    return mapper.mapRow(rs, 1);
                });

        doAnswer(invocation -> {
            CorrelationData cd = invocation.getArgument(4);
            cd.getFuture().complete(new CorrelationData.Confirm(true, null));
            return null;
        }).when(rabbitTemplate).convertAndSend(eq("shop.events"), eq("order.created"), any(OrderCreatedEvent.class),
                any(MessagePostProcessor.class), any(CorrelationData.class));

        dispatcher.dispatchPending();

        ArgumentCaptor<Object> payloadCaptor = ArgumentCaptor.forClass(Object.class);
        verify(rabbitTemplate).convertAndSend(eq("shop.events"), eq("order.created"), payloadCaptor.capture(),
                any(MessagePostProcessor.class), any(CorrelationData.class));

        assertThat(payloadCaptor.getValue()).isInstanceOf(OrderCreatedEvent.class);
        OrderCreatedEvent event = (OrderCreatedEvent) payloadCaptor.getValue();
        assertThat(event.getOrderNumber()).isEqualTo("ORD-100");

        verify(jdbcTemplate).update(contains("UPDATE message_outbox SET published_at = CURRENT_TIMESTAMP"), eq(1L));
    }

    @Test
    void dispatchesOrderStatusChangedEventSuccessfully() {
        when(jdbcTemplate.queryForList(anyString(), eq(Long.class), eq(50)))
                .thenReturn(List.of(2L));

        when(jdbcTemplate.update(contains("UPDATE message_outbox SET locked_until"), eq(2L)))
                .thenReturn(1);

        String payload = "{\"orderId\":200,\"orderNumber\":\"ORD-200\",\"oldStatus\":\"pending\",\"newStatus\":\"paid\"}";
        when(jdbcTemplate.queryForObject(contains("SELECT id, event_type"), any(RowMapper.class), eq(2L)))
                .thenAnswer(invocation -> {
                    RowMapper<?> mapper = invocation.getArgument(1);
                    var rs = mock(java.sql.ResultSet.class);
                    when(rs.getLong(1)).thenReturn(2L);
                    when(rs.getString(2)).thenReturn("order.status.changed");
                    when(rs.getString(3)).thenReturn("order.status.changed");
                    when(rs.getString(4)).thenReturn(payload);
                    return mapper.mapRow(rs, 1);
                });

        doAnswer(invocation -> {
            CorrelationData cd = invocation.getArgument(4);
            cd.getFuture().complete(new CorrelationData.Confirm(true, null));
            return null;
        }).when(rabbitTemplate).convertAndSend(eq("shop.events"), eq("order.status.changed"), any(OrderStatusChangedEvent.class),
                any(MessagePostProcessor.class), any(CorrelationData.class));

        dispatcher.dispatchPending();

        ArgumentCaptor<Object> payloadCaptor = ArgumentCaptor.forClass(Object.class);
        verify(rabbitTemplate).convertAndSend(eq("shop.events"), eq("order.status.changed"), payloadCaptor.capture(),
                any(MessagePostProcessor.class), any(CorrelationData.class));

        assertThat(payloadCaptor.getValue()).isInstanceOf(OrderStatusChangedEvent.class);
        OrderStatusChangedEvent event = (OrderStatusChangedEvent) payloadCaptor.getValue();
        assertThat(event.getOrderNumber()).isEqualTo("ORD-200");
        assertThat(event.getNewStatus()).isEqualTo("paid");

        verify(jdbcTemplate).update(contains("UPDATE message_outbox SET published_at = CURRENT_TIMESTAMP"), eq(2L));
    }

    @Test
    void dispatchesGenericEventAsJsonNode() {
        when(jdbcTemplate.queryForList(anyString(), eq(Long.class), eq(50)))
                .thenReturn(List.of(3L));

        when(jdbcTemplate.update(contains("UPDATE message_outbox SET locked_until"), eq(3L)))
                .thenReturn(1);

        String payload = "{\"customField\":\"customValue\",\"count\":42}";
        when(jdbcTemplate.queryForObject(contains("SELECT id, event_type"), any(RowMapper.class), eq(3L)))
                .thenAnswer(invocation -> {
                    RowMapper<?> mapper = invocation.getArgument(1);
                    var rs = mock(java.sql.ResultSet.class);
                    when(rs.getLong(1)).thenReturn(3L);
                    when(rs.getString(2)).thenReturn("custom.notification");
                    when(rs.getString(3)).thenReturn("custom.routing.key");
                    when(rs.getString(4)).thenReturn(payload);
                    return mapper.mapRow(rs, 1);
                });

        doAnswer(invocation -> {
            CorrelationData cd = invocation.getArgument(4);
            cd.getFuture().complete(new CorrelationData.Confirm(true, null));
            return null;
        }).when(rabbitTemplate).convertAndSend(eq("shop.events"), eq("custom.routing.key"), any(),
                any(MessagePostProcessor.class), any(CorrelationData.class));

        dispatcher.dispatchPending();

        ArgumentCaptor<Object> payloadCaptor = ArgumentCaptor.forClass(Object.class);
        verify(rabbitTemplate).convertAndSend(eq("shop.events"), eq("custom.routing.key"), payloadCaptor.capture(),
                any(MessagePostProcessor.class), any(CorrelationData.class));

        assertThat(payloadCaptor.getValue()).isInstanceOf(JsonNode.class);
        JsonNode node = (JsonNode) payloadCaptor.getValue();
        assertThat(node.get("customField").asText()).isEqualTo("customValue");
    }
}
