package com.example.shop.modules.searchhistory.service;

import com.example.shop.common.exception.UnauthorizedException;
import com.example.shop.modules.user.entity.User;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.dao.DataAccessException;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.time.Duration;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class SearchHistoryServiceImpl implements SearchHistoryService {

    private final StringRedisTemplate redisTemplate;

    @Value("${application.search-history.max-entries:10}")
    private int maxEntries;

    @Value("${application.search-history.ttl-days:30}")
    private long ttlDays;

    @Override
    public void saveSearchTerm(User user, String query) {
        if (user == null) {
            return;
        }
        if (!StringUtils.hasText(query)) {
            return;
        }

        String normalized = query.trim();
        String key = buildKey(user.getId());

        try {
            redisTemplate.opsForList().remove(key, 0, normalized);
            redisTemplate.opsForList().leftPush(key, normalized);
            redisTemplate.opsForList().trim(key, 0, Math.max(0, maxEntries - 1));
            redisTemplate.expire(key, Duration.ofDays(Math.max(1, ttlDays)));
        } catch (DataAccessException | IllegalStateException ignored) {
            // Search history must not break product browsing if Redis is unavailable.
        }
    }

    @Override
    public List<String> getHistory(User user, int limit) {
        UUID userId = requireUser(user);
        int normalizedLimit = Math.max(1, Math.min(limit, Math.max(1, maxEntries)));
        String key = buildKey(userId);
        try {
            List<String> values = redisTemplate.opsForList().range(key, 0, normalizedLimit - 1);
            return values == null ? List.of() : values;
        } catch (DataAccessException | IllegalStateException ignored) {
            return List.of();
        }
    }

    @Override
    public void clearHistory(User user) {
        UUID userId = requireUser(user);
        try {
            redisTemplate.delete(buildKey(userId));
        } catch (DataAccessException | IllegalStateException ignored) {
            // Clearing history is best-effort.
        }
    }

    private UUID requireUser(User user) {
        if (user == null || user.getId() == null) {
            throw new UnauthorizedException("Login required");
        }
        return user.getId();
    }

    private String buildKey(UUID userId) {
        return "search:history:user:" + userId;
    }
}
