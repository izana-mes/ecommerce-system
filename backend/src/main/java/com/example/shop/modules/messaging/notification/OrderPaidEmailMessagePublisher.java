package com.example.shop.modules.messaging.notification;

import com.example.shop.modules.notification.dto.OrderPaidEmailRequest;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
@Slf4j
public class OrderPaidEmailMessagePublisher {

    private final ObjectProvider<RabbitTemplate> rabbitTemplate;

    @Value("${application.messaging.exchange}")
    private String exchange;

    @Value("${application.messaging.routing-key.order-paid-email}")
    private String routingKey;

    public void publish(OrderPaidEmailRequest message) {
        RabbitTemplate rt = rabbitTemplate.getIfAvailable();
        if (rt == null) {
            log.debug("Skipping order-paid email queue publish (RabbitMQ disabled)");
            return;
        }
        rt.convertAndSend(exchange, routingKey, message);
    }
}
