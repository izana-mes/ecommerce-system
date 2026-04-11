package com.example.shop.modules.messaging.inventory;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
@Slf4j
public class LowStockAlertPublisher {

    private final ObjectProvider<RabbitTemplate> rabbitTemplate;

    @Value("${application.messaging.exchange}")
    private String exchange;

    @Value("${application.messaging.routing-key.low-stock-alert}")
    private String routingKey;

    public void publish(LowStockAlertEvent event) {
        RabbitTemplate rt = rabbitTemplate.getIfAvailable();
        if (rt == null) {
            log.debug("Skipping low-stock publish (RabbitMQ disabled)");
            return;
        }
        log.warn("Publishing low stock alert: product={} remaining={}",
                event.getProductId(), event.getRemainingStock());
        rt.convertAndSend(exchange, routingKey, event);
    }
}
