package com.example.shop.config;

import java.util.HashMap;
import java.util.Map;

import org.springframework.util.StringUtils;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.env.EnvironmentPostProcessor;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.core.env.ConfigurableEnvironment;
import org.springframework.core.env.MapPropertySource;

/**
 * When running on Render ({@code RENDER=true}), apply safe defaults so the app starts without
 * Redis/RabbitMQ on localhost: use in-process cache and disable Rabbit unless explicitly enabled.
 * Explicit environment variables always win (they are usually defined in earlier property sources).
 */
@Order(Ordered.HIGHEST_PRECEDENCE + 10)
public class RenderIntegrationEnvironmentPostProcessor implements EnvironmentPostProcessor {

    private static final String REDIS_AUTO_CONFIG =
            "org.springframework.boot.autoconfigure.data.redis.RedisAutoConfiguration";
    private static final String REDIS_REPOS_AUTO_CONFIG =
            "org.springframework.boot.autoconfigure.data.redis.RedisRepositoriesAutoConfiguration";

    @Override
    public void postProcessEnvironment(ConfigurableEnvironment environment, SpringApplication application) {
        if (!"true".equalsIgnoreCase(environment.getProperty("RENDER"))) {
            return;
        }
        Map<String, Object> defaults = new HashMap<>();
        if (environment.getProperty("spring.rabbitmq.enabled") == null) {
            defaults.put("spring.rabbitmq.enabled", "false");
        }
        String cacheBackend = environment.getProperty("app.cache.backend");
        if (!StringUtils.hasText(cacheBackend)) {
            defaults.put("app.cache.backend", "simple");
            cacheBackend = "simple";
        }
        if ("simple".equals(cacheBackend) && environment.getProperty("spring.autoconfigure.exclude") == null) {
            defaults.put("spring.autoconfigure.exclude", REDIS_AUTO_CONFIG + "," + REDIS_REPOS_AUTO_CONFIG);
        }
        if (!defaults.isEmpty()) {
            environment.getPropertySources().addLast(new MapPropertySource("renderIntegrationDefaults", defaults));
        }
    }
}
