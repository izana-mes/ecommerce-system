package com.example.shop.modules.messaging.payment;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
@Slf4j
public class PaymentIpnMessagePublisher {

    private final ObjectProvider<RabbitTemplate> rabbitTemplate;

    @Value("${application.messaging.exchange}")
    private String exchange;

    @Value("${application.messaging.routing-key.payment-ipn}")
    private String routingKey;

    public boolean tryPublish(VnpayIpnMessage message) {
        RabbitTemplate rt = rabbitTemplate.getIfAvailable();
        if (rt == null) {
            return false;
        }
        try {
            rt.convertAndSend(exchange, routingKey, message);
            return true;
        } catch (Exception e) {
            log.warn("RabbitMQ publish failed for payment IPN: {}", e.getMessage());
            return false;
        }
    }

    public void publish(VnpayIpnMessage message) {
        if (!tryPublish(message)) {
            log.debug("Skipping payment IPN queue publish (RabbitMQ disabled)");
        }
    }
}
