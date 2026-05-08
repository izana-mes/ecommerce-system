package com.example.shop.common.web;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.util.Map;

/**
 * Lightweight health / liveness endpoint.
 *
 * <p>GET /          → redirects browsers to a useful message instead of an empty page.
 * <p>GET /api/health → used by Docker HEALTHCHECK, monitoring, and the frontend proxy.
 *
 * Both paths are {@code permitAll()} in {@link com.example.shop.config.SecurityConfig}.
 */
@RestController
public class HealthController {

    @GetMapping(value = {"/", "/api/health"})
    public ResponseEntity<Map<String, Object>> health() {
        return ResponseEntity.ok(Map.of(
                "status", "UP",
                "service", "shop-backend",
                "timestamp", Instant.now().toString()
        ));
    }
}
