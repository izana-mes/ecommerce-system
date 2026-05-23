package com.example.shop.modules.messaging.cart;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
@Slf4j
public class CartAbandonedEventPublisher {

    private final ObjectProvider<RabbitTemplate> rabbitTemplate;

    @Value("${application.messaging.exchange}")
    private String exchange;

    @Value("${application.messaging.routing-key.cart-abandoned}")
    private String routingKey;

    public void publish(CartAbandonedEvent event) {
        RabbitTemplate rt = rabbitTemplate.getIfAvailable();
        if (rt == null) {
            log.debug("Skipping cart-abandoned publish (RabbitMQ disabled)");
            return;
        }
        rt.convertAndSend(exchange, routingKey, event);
    }
}
