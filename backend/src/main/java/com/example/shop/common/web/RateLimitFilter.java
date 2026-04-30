package com.example.shop.common.web;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentLinkedDeque;

@Component
@RequiredArgsConstructor
@Slf4j
public class RateLimitFilter extends OncePerRequestFilter {

    private final ObjectMapper objectMapper;
    private final ClientIpExtractor clientIpExtractor;
    private final ConcurrentHashMap<String, ConcurrentLinkedDeque<Long>> buckets = new ConcurrentHashMap<>();

    private static final List<RateLimitRule> RULES = List.of(
            new RateLimitRule("POST", "/api/v1/auth/authenticate", 12, 60_000L, "login"),
            new RateLimitRule("POST", "/api/v1/auth/forgot-password", 6, 15 * 60_000L, "forgot_password"),
            new RateLimitRule("POST", "/api/v1/auth/reset-password", 12, 15 * 60_000L, "reset_password"),
            new RateLimitRule("POST", "/api/v1/auth/resend-otp", 8, 15 * 60_000L, "resend_otp"),
            new RateLimitRule("POST", "/api/v1/auth/verify-otp", 20, 15 * 60_000L, "verify_otp"),
            new RateLimitRule("POST", "/api/internal/notifications/order-paid", 60, 60_000L, "order_paid_notify"),
            new RateLimitRule("POST", "/api/internal/notifications/coupon-issued", 120, 60_000L, "coupon_issued_notify")
    );

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {
        RateLimitRule rule = findRule(request.getMethod(), request.getRequestURI());
        if (rule == null) {
            filterChain.doFilter(request, response);
            return;
        }

        String clientKey = extractClientIdentifier(request);
        String bucketKey = rule.name() + "::" + clientKey;
        if (isExceeded(bucketKey, rule)) {
            int retryAfterSeconds = Math.max(1, (int) Math.ceil(rule.windowMs() / 1000.0));
            response.setStatus(HttpStatus.TOO_MANY_REQUESTS.value());
            response.setContentType(MediaType.APPLICATION_JSON_VALUE);
            response.setHeader("Retry-After", String.valueOf(retryAfterSeconds));
            response.getWriter().write(objectMapper.writeValueAsString(Map.of(
                    "success", false,
                    "message", "Too many requests. Please retry later."
            )));
            log.warn("rate_limit_exceeded rule={} ip={} method={} path={}",
                    rule.name(), clientKey, request.getMethod(), request.getRequestURI());
            return;
        }

        filterChain.doFilter(request, response);
    }

    private boolean isExceeded(String bucketKey, RateLimitRule rule) {
        long now = System.currentTimeMillis();
        ConcurrentLinkedDeque<Long> deque = buckets.computeIfAbsent(bucketKey, key -> new ConcurrentLinkedDeque<>());
        synchronized (deque) {
            while (!deque.isEmpty() && now - deque.peekFirst() >= rule.windowMs()) {
                deque.pollFirst();
            }
            if (deque.size() >= rule.limit()) {
                return true;
            }
            deque.addLast(now);
            return false;
        }
    }

    private RateLimitRule findRule(String method, String path) {
        for (RateLimitRule rule : RULES) {
            if (rule.method().equalsIgnoreCase(method) && rule.path().equals(path)) {
                return rule;
            }
        }
        return null;
    }

    private String extractClientIdentifier(HttpServletRequest request) {
        return clientIpExtractor.extractClientIp(request);
    }

    private record RateLimitRule(String method, String path, int limit, long windowMs, String name) {
    }
}
