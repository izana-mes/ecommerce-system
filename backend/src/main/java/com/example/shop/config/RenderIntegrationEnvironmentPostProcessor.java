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
 * When running on Render, apply safe defaults so the app does not try Redis/RabbitMQ on
 * {@code localhost} (connection refused in logs). Render usually sets {@code RENDER} or
 * {@code RENDER_EXTERNAL_URL}; we also honor explicit {@code RENDER=true} from {@code render.yaml}.
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
        if (!isRunningOnRender(environment)) {
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

    private static boolean isRunningOnRender(ConfigurableEnvironment environment) {
        if ("true".equalsIgnoreCase(environment.getProperty("RENDER"))) {
            return true;
        }
        if (StringUtils.hasText(environment.getProperty("RENDER_EXTERNAL_URL"))) {
            return true;
        }
        if (StringUtils.hasText(environment.getProperty("RENDER_SERVICE_ID"))) {
            return true;
        }
        return false;
    }
}
