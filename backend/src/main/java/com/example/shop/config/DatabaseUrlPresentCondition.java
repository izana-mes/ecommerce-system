package com.example.shop.config;

import org.springframework.context.annotation.Condition;
import org.springframework.context.annotation.ConditionContext;
import org.springframework.core.type.AnnotatedTypeMetadata;

/**
 * True when a Render/Heroku-style Postgres URL env var is set (see {@link DatabaseUrlSupport}).
 */
public class DatabaseUrlPresentCondition implements Condition {

    @Override
    public boolean matches(ConditionContext context, AnnotatedTypeMetadata metadata) {
        return DatabaseUrlSupport.isPresent(context.getEnvironment());
    }
}
