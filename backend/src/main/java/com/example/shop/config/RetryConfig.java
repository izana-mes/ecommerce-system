package com.example.shop.config;

import org.springframework.amqp.core.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.util.Map;

/**
 * Retry configuration using TTL-based delayed requeing.
 * Failed messages are routed to delay queues (5s, 20s, 60s)
 * which then re-publish to the main exchange after TTL expires.
 */
@Configuration
@ConditionalOnRabbitEnabled
public class RetryConfig {

    @Value("${application.messaging.exchange}")
    private String exchangeName;

    private static final long[] DELAYS_MS = {5_000L, 20_000L, 60_000L};

    @Bean
    public DirectExchange retryExchange() {
        return ExchangeBuilder.directExchange(exchangeName + ".retry").durable(true).build();
    }

    @Bean
    public Queue retryDelayQueue1() {
        return buildDelayQueue(1, DELAYS_MS[0]);
    }

    @Bean
    public Queue retryDelayQueue2() {
        return buildDelayQueue(2, DELAYS_MS[1]);
    }

    @Bean
    public Queue retryDelayQueue3() {
        return buildDelayQueue(3, DELAYS_MS[2]);
    }

    @Bean
    public Binding retryDelayBinding1(Queue retryDelayQueue1, DirectExchange retryExchange) {
        return BindingBuilder.bind(retryDelayQueue1).to(retryExchange).with("retry.delay.1");
    }

    @Bean
    public Binding retryDelayBinding2(Queue retryDelayQueue2, DirectExchange retryExchange) {
        return BindingBuilder.bind(retryDelayQueue2).to(retryExchange).with("retry.delay.2");
    }

    @Bean
    public Binding retryDelayBinding3(Queue retryDelayQueue3, DirectExchange retryExchange) {
        return BindingBuilder.bind(retryDelayQueue3).to(retryExchange).with("retry.delay.3");
    }

    private Queue buildDelayQueue(int level, long ttlMs) {
        String queueName = exchangeName + ".retry.delay." + level;
        return QueueBuilder.durable(queueName)
                .withArguments(Map.of(
                        "x-message-ttl", ttlMs,
                        "x-dead-letter-exchange", exchangeName
                ))
                .build();
    }

    public static int getMaxRetries() {
        return DELAYS_MS.length;
    }

    public static String getRetryRoutingKey(int retryCount) {
        int level = Math.min(retryCount, DELAYS_MS.length);
        return "retry.delay." + level;
    }
}
