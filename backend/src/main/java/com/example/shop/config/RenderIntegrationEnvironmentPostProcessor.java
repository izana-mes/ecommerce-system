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
 * {@code localhost} (connection refused in logs). Detection uses {@code RENDER}, Render-provided
 * vars, or a Render Postgres {@code DATABASE_URL} ({@code dpg-} host / {@code .render.com}).
 * RabbitMQ stays enabled if {@code SPRING_RABBITMQ_URI} (or addresses) is set.
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
        if (environment.getProperty("spring.rabbitmq.enabled") == null && !hasExternalRabbitBroker(environment)) {
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
        return looksLikeRenderDatabaseUrl(environment.getProperty("DATABASE_URL"));
    }

    private static boolean looksLikeRenderDatabaseUrl(String databaseUrl) {
        if (!StringUtils.hasText(databaseUrl)) {
            return false;
        }
        String u = databaseUrl.toLowerCase();
        return u.contains("dpg-") || u.contains(".render.com");
    }

    private static boolean hasExternalRabbitBroker(ConfigurableEnvironment environment) {
        if (StringUtils.hasText(environment.getProperty("SPRING_RABBITMQ_URI"))) {
            return true;
        }
        if (StringUtils.hasText(environment.getProperty("SPRING_RABBITMQ_ADDRESSES"))) {
            return true;
        }
        String host = environment.getProperty("RABBITMQ_HOST");
        return StringUtils.hasText(host)
                && !"localhost".equalsIgnoreCase(host.trim())
                && !"127.0.0.1".equals(host.trim());
    }
}
