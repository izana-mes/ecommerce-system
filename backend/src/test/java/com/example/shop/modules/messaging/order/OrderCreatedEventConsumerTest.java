package com.example.shop.modules.messaging.order;

import com.example.shop.modules.notification.service.OrderCreatedNotificationService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ValueOperations;

import java.time.Duration;

import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class OrderCreatedEventConsumerTest {

    private OrderCreatedNotificationService notificationService;
    private StringRedisTemplate redisTemplate;
    private ValueOperations<String, String> valueOperations;
    private ObjectProvider<StringRedisTemplate> redisProvider;
    private OrderCreatedEventConsumer consumer;

    @BeforeEach
    @SuppressWarnings("unchecked")
    void setUp() {
        notificationService = mock(OrderCreatedNotificationService.class);
        redisTemplate = mock(StringRedisTemplate.class);
        valueOperations = mock(ValueOperations.class);
        redisProvider = mock(ObjectProvider.class);

        when(redisTemplate.opsForValue()).thenReturn(valueOperations);
        when(redisProvider.getIfAvailable()).thenReturn(redisTemplate);

        consumer = new OrderCreatedEventConsumer(notificationService, redisProvider);
    }

    @Test
    void processesFirstDeliveryAndSendsEmail() {
        OrderCreatedEvent event = OrderCreatedEvent.builder()
                .orderId(1L)
                .orderNumber("ORD-999")
                .customerEmail("customer@example.com")
                .build();

        when(valueOperations.setIfAbsent(eq("msg:idemp:order-created:ORD-999"), eq("1"), any(Duration.class)))
                .thenReturn(Boolean.TRUE);

        consumer.consume(event);

        verify(notificationService).sendOrderReceivedEmail(event);
    }

    @Test
    void suppressesDuplicateDeliveryWhenRedisKeyExists() {
        OrderCreatedEvent event = OrderCreatedEvent.builder()
                .orderId(1L)
                .orderNumber("ORD-999")
                .customerEmail("customer@example.com")
                .build();

        // Already exists in Redis (duplicate message delivery)
        when(valueOperations.setIfAbsent(eq("msg:idemp:order-created:ORD-999"), eq("1"), any(Duration.class)))
                .thenReturn(Boolean.FALSE);

        consumer.consume(event);

        verify(notificationService, never()).sendOrderReceivedEmail(any());
    }

    @Test
    void processesMessageGracefullyWhenRedisIsUnavailable() {
        OrderCreatedEvent event = OrderCreatedEvent.builder()
                .orderId(1L)
                .orderNumber("ORD-999")
                .customerEmail("customer@example.com")
                .build();

        when(redisProvider.getIfAvailable()).thenReturn(null);

        consumer.consume(event);

        verify(notificationService).sendOrderReceivedEmail(event);
    }
}
