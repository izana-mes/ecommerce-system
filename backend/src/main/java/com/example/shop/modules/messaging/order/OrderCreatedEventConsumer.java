package com.example.shop.modules.messaging.order;

import com.example.shop.config.ConditionalOnRabbitEnabled;
import com.example.shop.modules.notification.service.OrderCreatedNotificationService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
@ConditionalOnRabbitEnabled
@Slf4j
public class OrderCreatedEventConsumer {

    private final OrderCreatedNotificationService orderCreatedNotificationService;

    @RabbitListener(queues = "${application.messaging.queue.order-created}")
    public void consume(OrderCreatedEvent event) {
        if (event == null) {
            log.warn("Received null order created event");
            return;
        }
        log.info("Consumed order created event for order {}", event.getOrderNumber());
        orderCreatedNotificationService.sendOrderReceivedEmail(event);
    }
}
