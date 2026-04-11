package com.example.shop.modules.messaging.email;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
@Slf4j
public class EmailMessagePublisher {

    private final ObjectProvider<RabbitTemplate> rabbitTemplate;

    @Value("${application.messaging.exchange}")
    private String exchange;

    @Value("${application.messaging.routing-key.email-general}")
    private String routingKey;

    public void publish(EmailMessage message) {
        RabbitTemplate rt = rabbitTemplate.getIfAvailable();
        if (rt == null) {
            log.debug("Skipping email queue publish (RabbitMQ disabled)");
            return;
        }
        log.info("Publishing {} email to {}", message.getEmailType(), message.getTo());
        rt.convertAndSend(exchange, routingKey, message);
    }
}
