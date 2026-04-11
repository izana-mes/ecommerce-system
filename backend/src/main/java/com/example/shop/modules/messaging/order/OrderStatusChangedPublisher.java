package com.example.shop.modules.messaging.order;

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

    @Value("${application.messaging.exchange}")
    private String exchange;

    @Value("${application.messaging.routing-key.order-status-changed}")
    private String routingKey;

    public void publish(OrderStatusChangedEvent event) {
        RabbitTemplate rt = rabbitTemplate.getIfAvailable();
        if (rt == null) {
            log.debug("Skipping order-status-changed publish (RabbitMQ disabled)");
            return;
        }
        log.info("Publishing order status changed event: order={} {} -> {}",
                event.getOrderNumber(), event.getOldStatus(), event.getNewStatus());
        rt.convertAndSend(exchange, routingKey, event);
    }
}
