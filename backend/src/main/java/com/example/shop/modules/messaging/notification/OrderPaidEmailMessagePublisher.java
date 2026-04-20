package com.example.shop.modules.messaging.notification;

import com.example.shop.modules.notification.dto.OrderPaidEmailRequest;
import com.example.shop.modules.notification.service.OrderNotificationService;
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
    private final OrderNotificationService orderNotificationService;

    @Value("${application.messaging.exchange}")
    private String exchange;

    @Value("${application.messaging.routing-key.order-paid-email}")
    private String routingKey;

    public void publish(OrderPaidEmailRequest message) {
        RabbitTemplate rt = rabbitTemplate.getIfAvailable();
        if (rt != null) {
            try {
                log.info("Publishing order-paid email to queue for order {}", message.getOrderNumber());
                rt.convertAndSend(exchange, routingKey, message);
                return;
            } catch (Exception e) {
                log.warn("RabbitMQ publish failed for order-paid email, falling back to SMTP: {}", e.getMessage());
            }
        } else {
            log.debug("RabbitMQ unavailable; sending order-paid email via SMTP for order {}", message.getOrderNumber());
        }
        // Direct SMTP fallback (works when RabbitMQ is disabled on Render)
        try {
            orderNotificationService.sendOrderPaidEmail(message);
            log.info("Order-paid email sent via SMTP for order {}", message.getOrderNumber());
        } catch (Exception e) {
            log.error("Failed to send order-paid email via SMTP for order {}: {}", message.getOrderNumber(), e.getMessage(), e);
        }
    }
}
