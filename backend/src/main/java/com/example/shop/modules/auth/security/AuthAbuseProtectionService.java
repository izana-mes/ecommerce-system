package com.example.shop.modules.auth.security;

import com.example.shop.common.exception.BusinessException;
import com.example.shop.modules.security.SecurityEventLogger;
import lombok.RequiredArgsConstructor;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.script.DefaultRedisScript;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.util.List;

@Service
@RequiredArgsConstructor
public class AuthAbuseProtectionService {

    private final StringRedisTemplate redisTemplate;
    private final SecurityEventLogger securityEventLogger;

    private static final DefaultRedisScript<Long> INCR_WITH_TTL = new DefaultRedisScript<>(
            "local current = redis.call('INCR', KEYS[1]); " +
                    "if current == 1 then redis.call('EXPIRE', KEYS[1], ARGV[1]); end; " +
                    "return current;",
            Long.class
    );

    public void assertLoginAllowed(String email, String ip) {
        assertNotLocked("lock:login:email:" + safe(email), "Too many failed login attempts for this account");
        assertNotLocked("lock:login:ip:" + safe(ip), "Too many failed login attempts from this network");
    }

    public void recordLoginFailure(String email, String ip) {
        long emailFailures = increment("bf:login:email:" + safe(email), 900);
        long ipFailures = increment("bf:login:ip:" + safe(ip), 900);
        if (emailFailures >= 5) {
            long lockSeconds = Math.min(3600, (long) Math.pow(2, Math.min(10, emailFailures - 5)) * 30L);
            redisTemplate.opsForValue().set("lock:login:email:" + safe(email), "1", Duration.ofSeconds(lockSeconds));
            securityEventLogger.warn("login_account_lockout", java.util.Map.of(
                    "email", safe(email),
                    "lockSeconds", lockSeconds,
                    "ip", safe(ip)
            ));
        }
        if (ipFailures >= 15) {
            redisTemplate.opsForValue().set("lock:login:ip:" + safe(ip), "1", Duration.ofMinutes(15));
            securityEventLogger.warn("login_ip_lockout", java.util.Map.of(
                    "ip", safe(ip),
                    "windowSeconds", 900
            ));
        }
    }

    public void recordLoginSuccess(String email, String ip) {
        redisTemplate.delete(List.of(
                "bf:login:email:" + safe(email),
                "bf:login:ip:" + safe(ip),
                "lock:login:email:" + safe(email),
                "lock:login:ip:" + safe(ip)
        ));
    }

    public void assertRefreshAllowed(String userKey, String ip) {
        if (userKey != null && !userKey.isBlank() && !"unknown".equalsIgnoreCase(userKey.trim())) {
            assertNotLocked("lock:refresh:user:" + safe(userKey), "Refresh temporarily blocked for this account");
        }
        assertNotLocked("lock:refresh:ip:" + safe(ip), "Refresh temporarily blocked from this network");
    }

    public void recordRefreshFailure(String userKey, String ip) {
        long userFailures = increment("bf:refresh:user:" + safe(userKey), 300);
        long ipFailures = increment("bf:refresh:ip:" + safe(ip), 300);
        if (userFailures >= 6) {
            redisTemplate.opsForValue().set("lock:refresh:user:" + safe(userKey), "1", Duration.ofMinutes(10));
            securityEventLogger.warn("refresh_user_lockout", java.util.Map.of(
                    "userKey", safe(userKey),
                    "ip", safe(ip)
            ));
        }
        if (ipFailures >= 30) {
            redisTemplate.opsForValue().set("lock:refresh:ip:" + safe(ip), "1", Duration.ofMinutes(10));
            securityEventLogger.warn("refresh_ip_lockout", java.util.Map.of(
                    "ip", safe(ip),
                    "userKey", safe(userKey)
            ));
        }
    }

    public void recordRefreshSuccess(String userKey, String ip) {
        redisTemplate.delete(List.of(
                "bf:refresh:user:" + safe(userKey),
                "bf:refresh:ip:" + safe(ip)
        ));
    }

    public void recordRefreshReuse(String userKey, String ip) {
        redisTemplate.opsForValue().set("lock:refresh:user:" + safe(userKey), "1", Duration.ofMinutes(30));
        redisTemplate.opsForValue().set("lock:refresh:ip:" + safe(ip), "1", Duration.ofMinutes(30));
        securityEventLogger.warn("refresh_reuse_lockout", java.util.Map.of(
                "userKey", safe(userKey),
                "ip", safe(ip)
        ));
    }

    private void assertNotLocked(String key, String message) {
        String lock = redisTemplate.opsForValue().get(key);
        if (lock != null) {
            throw new BusinessException(message, HttpStatus.TOO_MANY_REQUESTS);
        }
    }

    private long increment(String key, int ttlSeconds) {
        Long value = redisTemplate.execute(INCR_WITH_TTL, List.of(key), String.valueOf(ttlSeconds));
        return value == null ? 0L : value;
    }

    private String safe(String value) {
        return value == null || value.isBlank() ? "unknown" : value.trim().toLowerCase();
    }
}
