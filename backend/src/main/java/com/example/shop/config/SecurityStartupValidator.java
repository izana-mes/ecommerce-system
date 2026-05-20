package com.example.shop.config;

import jakarta.annotation.PostConstruct;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.Set;

@Component
public class SecurityStartupValidator {

    private static final Set<String> BLOCKED_SECRETS = Set.of(
            "change-me",
            "default",
            "secret",
            "admin123"
    );

    @Value("${application.security.jwt.secret-key:}")
    private String jwtSecret;

    @PostConstruct
    public void validate() {
        if (jwtSecret == null || jwtSecret.isBlank()) {
            throw new IllegalStateException("Startup blocked: JWT secret is missing");
        }
        String lower = jwtSecret.toLowerCase();
        if (BLOCKED_SECRETS.stream().anyMatch(lower::contains)) {
            throw new IllegalStateException("Startup blocked: JWT secret is weak/default");
        }
        byte[] decoded = Base64.getDecoder().decode(jwtSecret.getBytes(StandardCharsets.UTF_8));
        if (decoded.length < 32) {
            throw new IllegalStateException("Startup blocked: JWT secret must be at least 256-bit base64");
        }
    }
}
