package com.example.shop.modules.messaging.order;

import com.example.shop.modules.messaging.outbox.MessageOutboxService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
@Slf4j
public class OrderStatusChangedPublisher {

    private final ObjectProvider<RabbitTemplate> rabbitTemplate;
    private final ObjectProvider<MessageOutboxService> messageOutboxService;

    @Value("${application.messaging.exchange}")
    private String exchange;

    @Value("${application.messaging.routing-key.order-status-changed}")
    private String routingKey;

    public void publish(OrderStatusChangedEvent event) {
        if (event == null) {
            return;
        }
        RabbitTemplate rt = rabbitTemplate.getIfAvailable();
        if (rt == null) {
            log.debug("Skipping order-status-changed direct publish (RabbitMQ disabled)");
            return;
        }
        try {
            log.info("Publishing order status changed event: order={} {} -> {}",
                    event.getOrderNumber(), event.getOldStatus(), event.getNewStatus());
            rt.convertAndSend(exchange, routingKey, event);
        } catch (Exception ex) {
            log.warn("Direct publish failed for order status change (order={}), falling back to outbox: {}",
                    event.getOrderNumber(), ex.getMessage());
            MessageOutboxService outbox = messageOutboxService.getIfAvailable();
            if (outbox != null) {
                outbox.enqueue("order.status.changed", routingKey, event);
            }
        }
    }
}

