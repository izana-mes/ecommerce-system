package com.example.shop.config;

import org.springframework.core.env.Environment;
import org.springframework.util.StringUtils;

public final class DatabaseUrlSupport {

    private static final String[] KEYS = {"DATABASE_URL", "POSTGRES_URL", "RENDER_DATABASE_URL"};

    private DatabaseUrlSupport() {}

    public static boolean isPresent(Environment environment) {
        for (String key : KEYS) {
            if (StringUtils.hasText(environment.getProperty(key))) {
                return true;
            }
        }
        return false;
    }

    public static String getRequired(Environment environment) {
        for (String key : KEYS) {
            String value = environment.getProperty(key);
            if (StringUtils.hasText(value)) {
                return value.trim();
            }
        }
        throw new IllegalStateException(
                "Expected one of " + String.join(", ", KEYS) + " to be set when using a managed Postgres URL");
    }
}
