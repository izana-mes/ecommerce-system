package com.example.shop.modules.messaging.retry;

import com.example.shop.config.ConditionalOnRabbitEnabled;
import com.example.shop.config.RetryConfig;
import lombok.extern.slf4j.Slf4j;
import org.springframework.amqp.core.Message;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Map;

/**
 * Utility for retrying failed messages with exponential backoff.
 * Usage: call {@link #retryOrDlq(Message, Exception, RabbitTemplate)} in a catch block.
 */
@Component
@ConditionalOnRabbitEnabled
@Slf4j
public class RetryableMessageHandler {

    @Value("${application.messaging.exchange}")
    private String exchangeName;

    private static final String RETRY_COUNT_HEADER = "x-retry-count";
    private static final String ORIGINAL_ROUTING_KEY_HEADER = "x-original-routing-key";

    /**
     * Retry the message or send to DLQ if max retries exceeded.
     */
    public void retryOrDlq(Message message, Exception error, RabbitTemplate rabbitTemplate) {
        int retryCount = getRetryCount(message);
        int maxRetries = RetryConfig.getMaxRetries();

        if (retryCount >= maxRetries) {
            log.error("Max retries ({}) exceeded for message on queue {}. Sending to DLQ.",
                    maxRetries, message.getMessageProperties().getConsumerQueue(), error);
            throw new RuntimeException("Max retries exceeded", error);
        }

        int nextRetry = retryCount + 1;
        String retryRoutingKey = RetryConfig.getRetryRoutingKey(nextRetry);

        // Preserve original routing key for re-delivery
        String originalRoutingKey = getOriginalRoutingKey(message);

        message.getMessageProperties().setHeader(RETRY_COUNT_HEADER, nextRetry);
        message.getMessageProperties().setHeader(ORIGINAL_ROUTING_KEY_HEADER, originalRoutingKey);

        log.warn("Retrying message (attempt {}/{}) via {}: {}",
                nextRetry, maxRetries, retryRoutingKey, error.getMessage());

        rabbitTemplate.send(exchangeName + ".retry", retryRoutingKey, message);
    }

    private int getRetryCount(Message message) {
        Object header = message.getMessageProperties().getHeader(RETRY_COUNT_HEADER);
        if (header instanceof Number) {
            return ((Number) header).intValue();
        }
        // Check x-death header for DLQ-based retry count
        Object xDeath = message.getMessageProperties().getHeader("x-death");
        if (xDeath instanceof List<?> deathList && !deathList.isEmpty()) {
            Object first = deathList.getFirst();
            if (first instanceof Map<?, ?> deathMap) {
                Object count = deathMap.get("count");
                if (count instanceof Number) {
                    return ((Number) count).intValue();
                }
            }
        }
        return 0;
    }

    private String getOriginalRoutingKey(Message message) {
        Object header = message.getMessageProperties().getHeader(ORIGINAL_ROUTING_KEY_HEADER);
        if (header instanceof String s && !s.isBlank()) {
            return s;
        }
        return message.getMessageProperties().getReceivedRoutingKey();
    }
}
