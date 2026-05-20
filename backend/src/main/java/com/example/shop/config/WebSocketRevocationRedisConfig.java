package com.example.shop.config;

import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.redis.connection.RedisConnectionFactory;
import org.springframework.data.redis.listener.PatternTopic;
import org.springframework.data.redis.listener.RedisMessageListenerContainer;

@Configuration
@RequiredArgsConstructor
public class WebSocketRevocationRedisConfig {

    private final WebSocketRevocationSubscriber webSocketRevocationSubscriber;

    @Bean
    public RedisMessageListenerContainer websocketRevocationListenerContainer(RedisConnectionFactory connectionFactory) {
        RedisMessageListenerContainer container = new RedisMessageListenerContainer();
        container.setConnectionFactory(connectionFactory);
        container.addMessageListener(webSocketRevocationSubscriber, new PatternTopic("auth:revoke:*"));
        return container;
    }
}
