package com.example.shop.modules.auth.security;

import com.example.shop.config.WebSocketRevocationEventPublisher;
import com.example.shop.modules.security.SecurityEventLogger;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.RedisConnectionFailureException;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Set;

@Service
@RequiredArgsConstructor
public class AccessTokenRevocationService {

    private final StringRedisTemplate redisTemplate;
    private final SecurityEventLogger securityEventLogger;
    private final WebSocketRevocationEventPublisher webSocketRevocationEventPublisher;

    @Value("${application.security.jwt.revocation.fail-closed:false}")
    private boolean failClosed;

    @Value("${application.security.jwt.revocation.max-ttl-seconds:7200}")
    private long maxTtlSeconds;

    public void revokeAccessToken(String jti, Instant expiresAt, String reason, String requestId) {
        Duration ttl = ttlUntil(expiresAt);
        if (ttl.isZero()) {
            return;
        }
        try {
            redisTemplate.opsForValue().set(revokedJtiKey(jti), marker(reason), ttl);
            webSocketRevocationEventPublisher.publish("jti", jti, reasonOrDefault(reason), requestId);
            securityEventLogger.warn("access_jti_revoked", Map.of(
                    "jti", safe(jti),
                    "reason", safe(reason),
                    "ttlSeconds", ttl.getSeconds(),
                    "requestId", safe(requestId)
            ));
        } catch (RedisConnectionFailureException ex) {
            onRedisFailure("revoke_access_jti", jti, requestId, ex);
        }
    }

    public void linkAccessToken(String jti, Instant expiresAt, String sessionId, String familyId, String userId, String requestId) {
        Duration ttl = ttlUntil(expiresAt);
        if (ttl.isZero()) {
            return;
        }
        try {
            if (sessionId != null && !sessionId.isBlank()) {
                String sessionKey = sessionJtisKey(sessionId);
                redisTemplate.opsForSet().add(sessionKey, jti);
                redisTemplate.expire(sessionKey, ttl);
            }
            if (familyId != null && !familyId.isBlank()) {
                String familyKey = familyJtisKey(familyId);
                redisTemplate.opsForSet().add(familyKey, jti);
                redisTemplate.expire(familyKey, ttl);
            }
            if (userId != null && !userId.isBlank()) {
                String userKey = userJtisKey(userId);
                redisTemplate.opsForSet().add(userKey, jti);
                redisTemplate.expire(userKey, ttl);
            }
            redisTemplate.opsForValue().set(accessMetaKey(jti), "1", ttl);
        } catch (RedisConnectionFailureException ex) {
            onRedisFailure("link_access_jti", jti, requestId, ex);
        }
    }

    public void revokeSessionAccessTokens(String sessionId, String reason, String requestId) {
        webSocketRevocationEventPublisher.publish("session", sessionId, reasonOrDefault(reason), requestId);
        revokeByCollection(sessionJtisKey(sessionId), reason, requestId, "session");
    }

    public void revokeFamilyAccessTokens(String familyId, String reason, String requestId) {
        webSocketRevocationEventPublisher.publish("family", familyId, reasonOrDefault(reason), requestId);
        revokeByCollection(familyJtisKey(familyId), reason, requestId, "family");
    }

    public void revokeUserAccessTokens(String userId, String reason, String requestId) {
        webSocketRevocationEventPublisher.publish("user", userId, reasonOrDefault(reason), requestId);
        revokeByCollection(userJtisKey(userId), reason, requestId, "user");
    }

    public boolean isRevoked(String jti, String requestId) {
        try {
            Boolean exists = redisTemplate.hasKey(revokedJtiKey(jti));
            boolean hit = Boolean.TRUE.equals(exists);
            if (hit) {
                securityEventLogger.warn("access_denylist_hit", Map.of(
                        "jti", safe(jti),
                        "requestId", safe(requestId)
                ));
            }
            return hit;
        } catch (RedisConnectionFailureException ex) {
            onRedisFailure("check_access_jti", jti, requestId, ex);
            return failClosed;
        }
    }

    public boolean shouldFailClosed() {
        return failClosed;
    }

    private void revokeByCollection(String key, String reason, String requestId, String scope) {
        if (key == null || key.isBlank()) {
            return;
        }
        try {
            Set<String> jtIs = redisTemplate.opsForSet().members(key);
            if (jtIs == null || jtIs.isEmpty()) {
                return;
            }
            int revoked = 0;
            for (String jti : jtIs) {
                Long ttlSeconds = redisTemplate.getExpire(accessMetaKey(jti));
                Duration ttl = ttlSeconds == null || ttlSeconds <= 0
                        ? Duration.ofSeconds(Math.min(maxTtlSeconds, 60))
                        : Duration.ofSeconds(Math.min(ttlSeconds, maxTtlSeconds));
                redisTemplate.opsForValue().set(revokedJtiKey(jti), marker(reason), ttl);
                revoked++;
            }
            Map<String, Object> payload = new LinkedHashMap<>();
            payload.put("scope", scope);
            payload.put("key", key);
            payload.put("revokedCount", revoked);
            payload.put("reason", safe(reason));
            payload.put("requestId", safe(requestId));
            securityEventLogger.warn("mass_access_revocation", payload);
        } catch (RedisConnectionFailureException ex) {
            onRedisFailure("mass_revoke_access_jti", key, requestId, ex);
        }
    }

    private Duration ttlUntil(Instant expiresAt) {
        if (expiresAt == null) return Duration.ZERO;
        long seconds = Duration.between(Instant.now(), expiresAt).getSeconds();
        if (seconds <= 0) return Duration.ZERO;
        return Duration.ofSeconds(Math.min(seconds, maxTtlSeconds));
    }

    private void onRedisFailure(String operation, String id, String requestId, Exception ex) {
        securityEventLogger.warn("access_revocation_redis_failure", Map.of(
                "operation", operation,
                "id", safe(id),
                "requestId", safe(requestId),
                "failClosed", failClosed,
                "errorType", ex.getClass().getSimpleName()
        ));
    }

    private String marker(String reason) {
        return reason == null ? "revoked" : reason;
    }

    private String reasonOrDefault(String reason) {
        return reason == null || reason.isBlank() ? "TOKEN_REVOKED" : reason;
    }

    private String revokedJtiKey(String jti) {
        return "revoked:jti:" + jti;
    }

    private String sessionJtisKey(String sessionId) {
        return "session:jtis:" + sessionId;
    }

    private String familyJtisKey(String familyId) {
        return "family:jtis:" + familyId;
    }

    private String userJtisKey(String userId) {
        return "user:jtis:" + userId;
    }

    private String accessMetaKey(String jti) {
        return "access:meta:jti:" + jti;
    }

    private String safe(String value) {
        return value == null ? "" : value;
    }
}
