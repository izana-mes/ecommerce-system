package com.example.shop.modules.messaging.notification;

import com.example.shop.config.ConditionalOnRabbitEnabled;
import com.example.shop.modules.notification.dto.OrderPaidEmailRequest;
import com.example.shop.modules.notification.service.OrderNotificationService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
@ConditionalOnRabbitEnabled
@Slf4j
public class OrderPaidEmailMessageConsumer {

    private final OrderNotificationService orderNotificationService;

    @RabbitListener(queues = "${application.messaging.queue.order-paid-email}")
    public void consume(OrderPaidEmailRequest message) {
        if (message == null) {
            log.warn("Received null order paid email message");
            return;
        }
        orderNotificationService.sendOrderPaidEmail(message);
    }
}
