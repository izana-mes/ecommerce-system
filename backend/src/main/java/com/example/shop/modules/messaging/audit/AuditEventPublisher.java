package com.example.shop.modules.messaging.audit;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
@Slf4j
public class AuditEventPublisher {

    private final ObjectProvider<RabbitTemplate> rabbitTemplate;

    @Value("${application.messaging.exchange}")
    private String exchange;

    @Value("${application.messaging.routing-key.audit-event}")
    private String routingKey;

    public void publish(AuditEvent event) {
        RabbitTemplate rt = rabbitTemplate.getIfAvailable();
        if (rt == null) {
            log.debug("Skipping audit event publish (RabbitMQ disabled)");
            return;
        }
        try {
            rt.convertAndSend(exchange, routingKey, event);
        } catch (Exception e) {
            log.error("Failed to publish audit event: type={} entity={}/{}",
                    event.getEventType(), event.getEntityType(), event.getEntityId(), e);
        }
    }
}
