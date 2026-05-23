package com.example.shop.modules.inventory.messaging;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
@Slf4j
public class InventoryReservationEventPublisher {

    private final ObjectProvider<RabbitTemplate> rabbitTemplate;

    @Value("${application.messaging.exchange}")
    private String exchange;

    @Value("${application.messaging.routing-key.inventory-reserved:inventory.reserved}")
    private String reservedRoutingKey;

    @Value("${application.messaging.routing-key.inventory-released:inventory.released}")
    private String releasedRoutingKey;

    public void publishReserved(InventoryReservationEvent event) {
        publish(reservedRoutingKey, event);
    }

    public void publishReleased(InventoryReservationEvent event) {
        publish(releasedRoutingKey, event);
    }

    private void publish(String routingKey, InventoryReservationEvent event) {
        RabbitTemplate rt = rabbitTemplate.getIfAvailable();
        if (rt == null) {
            log.debug("Skipping inventory reservation publish (RabbitMQ disabled)");
            return;
        }
        rt.convertAndSend(exchange, routingKey, event);
    }
}
