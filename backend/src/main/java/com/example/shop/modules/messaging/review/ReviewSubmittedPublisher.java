package com.example.shop.modules.messaging.review;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
@Slf4j
public class ReviewSubmittedPublisher {

    private final ObjectProvider<RabbitTemplate> rabbitTemplate;

    @Value("${application.messaging.exchange}")
    private String exchange;

    @Value("${application.messaging.routing-key.review-submitted}")
    private String routingKey;

    public void publish(ReviewSubmittedEvent event) {
        RabbitTemplate rt = rabbitTemplate.getIfAvailable();
        if (rt == null) {
            log.debug("Skipping review-submitted publish (RabbitMQ disabled)");
            return;
        }
        log.info("Publishing review submitted event: product={} author={}",
                event.getProductId(), event.getAuthor());
        rt.convertAndSend(exchange, routingKey, event);
    }
}
