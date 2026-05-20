package com.example.shop.common.web;

import com.example.shop.common.observability.ObservabilityMetrics;
import com.example.shop.modules.security.RequestIdHolder;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.script.DefaultRedisScript;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.List;
import java.util.Map;

@Component
@RequiredArgsConstructor
@Slf4j
public class RateLimitFilter extends OncePerRequestFilter {

    private final ObjectMapper objectMapper;
    private final ClientIpExtractor clientIpExtractor;
    private final StringRedisTemplate redisTemplate;
    private final ObservabilityMetrics observabilityMetrics;

    private static final List<RateLimitRule> RULES = List.of(
            new RateLimitRule("POST", "/api/v1/auth/authenticate", 10, 60, "login"),
            new RateLimitRule("POST", "/api/v1/auth/register", 8, 60, "register"),
            new RateLimitRule("POST", "/api/v1/auth/forgot-password", 6, 900, "forgot_password"),
            new RateLimitRule("POST", "/api/v1/auth/reset-password", 10, 900, "reset_password"),
            new RateLimitRule("POST", "/api/payments", 30, 60, "payments"),
            new RateLimitRule("POST", "/api/chatbot", 50, 60, "chatbot"),
            new RateLimitRule("/api/v1/admin", 100, 60, "admin")
    );

    private static final DefaultRedisScript<Long> LUA = new DefaultRedisScript<>(
            "local current = redis.call('INCR', KEYS[1]); " +
                    "if current == 1 then redis.call('EXPIRE', KEYS[1], ARGV[1]); end; " +
                    "return current;",
            Long.class
    );

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {
        RateLimitRule rule = findRule(request.getMethod(), request.getRequestURI());
        if (rule == null) {
            filterChain.doFilter(request, response);
            return;
        }

        String key = "rl:" + rule.name() + ":" + keyDimension(request);
        Long count = redisTemplate.execute(LUA, List.of(key), String.valueOf(rule.windowSeconds()));
        if (count != null && count > rule.limit()) {
            observabilityMetrics.recordRateLimit(rule.name(), true);
            response.setStatus(HttpStatus.TOO_MANY_REQUESTS.value());
            response.setContentType(MediaType.APPLICATION_JSON_VALUE);
            response.setHeader("Retry-After", String.valueOf(rule.windowSeconds()));
            response.getWriter().write(objectMapper.writeValueAsString(Map.of(
                    "success", false,
                    "message", "Too many requests. Please retry later.",
                    "requestId", RequestIdHolder.getOrDefault()
            )));
            log.warn("rate_limit_exceeded rule={} key={} path={}", rule.name(), key, request.getRequestURI());
            return;
        }

        observabilityMetrics.recordRateLimit(rule.name(), false);
        filterChain.doFilter(request, response);
    }

    private String keyDimension(HttpServletRequest request) {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.isAuthenticated() && StringUtils.hasText(auth.getName())) {
            return "user:" + auth.getName();
        }
        return "ip:" + clientIpExtractor.extractClientIp(request);
    }

    private RateLimitRule findRule(String method, String path) {
        for (RateLimitRule rule : RULES) {
            if (!rule.method().isBlank() && rule.method().equalsIgnoreCase(method) && rule.pathPrefix().equals(path)) {
                return rule;
            }
            if (rule.method().isBlank() && path.startsWith(rule.pathPrefix())) {
                return rule;
            }
        }
        return null;
    }

    private record RateLimitRule(String method, String pathPrefix, int limit, int windowSeconds, String name) {
        private RateLimitRule(String pathPrefix, int limit, int windowSeconds, String name) {
            this("", pathPrefix, limit, windowSeconds, name);
        }
    }
}
