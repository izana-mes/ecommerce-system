package com.example.shop.modules.messaging.order;

import com.example.shop.config.ConditionalOnRabbitEnabled;
import com.example.shop.modules.notification.service.OrderCreatedNotificationService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Component;

import java.time.Duration;

@Component
@RequiredArgsConstructor
@ConditionalOnRabbitEnabled
@Slf4j
public class OrderCreatedEventConsumer {

    private final OrderCreatedNotificationService orderCreatedNotificationService;
    private final ObjectProvider<StringRedisTemplate> redisTemplateProvider;

    private static final Duration DEDUP_TTL = Duration.ofHours(24);

    @RabbitListener(queues = "${application.messaging.queue.order-created}")
    public void consume(OrderCreatedEvent event) {
        if (event == null || event.getOrderNumber() == null || event.getOrderNumber().isBlank()) {
            log.warn("Received null or invalid order created event");
            return;
        }

        StringRedisTemplate redis = redisTemplateProvider.getIfAvailable();
        if (redis != null) {
            String dedupKey = "msg:idemp:order-created:" + event.getOrderNumber().trim();
            try {
                Boolean isNew = redis.opsForValue().setIfAbsent(dedupKey, "1", DEDUP_TTL);
                if (Boolean.FALSE.equals(isNew)) {
                    log.info("Duplicate order created event skipped for order {}", event.getOrderNumber());
                    return;
                }
            } catch (Exception ex) {
                log.warn("Redis dedup check failed for order created {}, processing anyway: {}",
                        event.getOrderNumber(), ex.getMessage());
            }
        }

        log.info("Consumed order created event for order {}", event.getOrderNumber());
        orderCreatedNotificationService.sendOrderReceivedEmail(event);
    }
}

