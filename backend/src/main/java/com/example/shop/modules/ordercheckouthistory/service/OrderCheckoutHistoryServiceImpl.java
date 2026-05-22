package com.example.shop.modules.ordercheckouthistory.service;

import com.example.shop.common.exception.UnauthorizedException;
import com.example.shop.modules.order.dto.OrderCreateRequest;
import com.example.shop.modules.ordercheckouthistory.dto.CheckoutHistoryEntryDto;
import com.example.shop.modules.user.entity.User;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.dao.DataAccessException;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class OrderCheckoutHistoryServiceImpl implements OrderCheckoutHistoryService {

    private final StringRedisTemplate redisTemplate;
    private final ObjectMapper objectMapper;

    @Value("${application.checkout-history.max-entries:8}")
    private int maxEntries;

    @Value("${application.checkout-history.ttl-days:90}")
    private long ttlDays;

    @Override
    public void saveCheckoutInfo(User user, OrderCreateRequest request, String effectiveEmail) {
        if (user == null || user.getId() == null || request == null) {
            return;
        }

        CheckoutHistoryEntryDto entry = CheckoutHistoryEntryDto.builder()
                .firstName(clean(request.getCustomerFirstName()))
                .lastName(clean(request.getCustomerLastName()))
                .companyName(extractCompanyName(request.getNotes()))
                .country(clean(request.getShippingCountry()))
                .streetAddress1(clean(request.getShippingAddressLine1()))
                .streetAddress2(clean(request.getShippingAddressLine2()))
                .city(clean(request.getShippingCity()))
                .postalCode(clean(request.getShippingPostalCode()))
                .phone(clean(request.getCustomerPhone()))
                .email(clean(effectiveEmail))
                .notes(clean(stripCompanyPrefix(request.getNotes())))
                .savedAt(System.currentTimeMillis())
                .build();

        if (!hasAnyValue(entry)) {
            return;
        }

        String key = buildKey(user.getId());
        try {
            String serialized = objectMapper.writeValueAsString(entry);
            redisTemplate.opsForList().remove(key, 0, serialized);
            redisTemplate.opsForList().leftPush(key, serialized);
            redisTemplate.opsForList().trim(key, 0, Math.max(0, maxEntries - 1));
            redisTemplate.expire(key, Duration.ofDays(Math.max(1, ttlDays)));
        } catch (DataAccessException | IllegalStateException | com.fasterxml.jackson.core.JsonProcessingException ignored) {
            // Checkout history is best-effort and must not block order placement.
        }
    }

    @Override
    public List<CheckoutHistoryEntryDto> getHistory(User user, int limit) {
        UUID userId = requireUser(user);
        int normalizedLimit = Math.max(1, Math.min(limit, Math.max(1, maxEntries)));
        String key = buildKey(userId);
        try {
            List<String> values = redisTemplate.opsForList().range(key, 0, normalizedLimit - 1);
            if (values == null || values.isEmpty()) {
                return List.of();
            }
            List<CheckoutHistoryEntryDto> result = new ArrayList<>();
            for (String value : values) {
                if (!StringUtils.hasText(value)) {
                    continue;
                }
                try {
                    result.add(objectMapper.readValue(value, CheckoutHistoryEntryDto.class));
                } catch (com.fasterxml.jackson.core.JsonProcessingException ignored) {
                    // Skip corrupted item.
                }
            }
            return result;
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
            // Best-effort clear.
        }
    }

    private UUID requireUser(User user) {
        if (user == null || user.getId() == null) {
            throw new UnauthorizedException("Login required");
        }
        return user.getId();
    }

    private String buildKey(UUID userId) {
        return "checkout:history:user:" + userId;
    }

    private String clean(String value) {
        if (!StringUtils.hasText(value)) {
            return null;
        }
        String normalized = value.trim();
        return normalized.isEmpty() ? null : normalized;
    }

    private boolean hasAnyValue(CheckoutHistoryEntryDto entry) {
        return StringUtils.hasText(entry.firstName())
                || StringUtils.hasText(entry.lastName())
                || StringUtils.hasText(entry.companyName())
                || StringUtils.hasText(entry.country())
                || StringUtils.hasText(entry.streetAddress1())
                || StringUtils.hasText(entry.streetAddress2())
                || StringUtils.hasText(entry.city())
                || StringUtils.hasText(entry.postalCode())
                || StringUtils.hasText(entry.phone())
                || StringUtils.hasText(entry.email())
                || StringUtils.hasText(entry.notes());
    }

    private String extractCompanyName(String notes) {
        if (!StringUtils.hasText(notes)) {
            return null;
        }
        for (String line : notes.split("\\R")) {
            if (line != null && line.startsWith("Company:")) {
                return clean(line.substring("Company:".length()));
            }
        }
        return null;
    }

    private String stripCompanyPrefix(String notes) {
        if (!StringUtils.hasText(notes)) {
            return null;
        }
        StringBuilder sb = new StringBuilder();
        for (String line : notes.split("\\R")) {
            if (line == null || line.startsWith("Company:")) {
                continue;
            }
            if (!line.trim().isEmpty()) {
                if (sb.length() > 0) {
                    sb.append('\n');
                }
                sb.append(line.trim());
            }
        }
        return clean(sb.toString());
    }
}
