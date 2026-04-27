package com.example.shop.config;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;

import java.lang.annotation.Documented;
import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/**
 * Messaging beans (RabbitMQ exchanges, listeners) load only when Rabbit is explicitly enabled.
 * On Render, {@link RenderIntegrationEnvironmentPostProcessor} sets {@code spring.rabbitmq.enabled=false}
 * unless you override it explicitly with {@code true}.
 */
@Retention(RetentionPolicy.RUNTIME)
@Target({ElementType.TYPE, ElementType.METHOD})
@Documented
@ConditionalOnProperty(prefix = "spring.rabbitmq", name = "enabled", havingValue = "true", matchIfMissing = false)
public @interface ConditionalOnRabbitEnabled {
}
