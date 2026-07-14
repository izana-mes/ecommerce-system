package com.example.shop.modules.cart.service;

import com.example.shop.modules.cart.repository.AbandonedCartCandidateProjection;
import com.example.shop.modules.cart.repository.CartItemRepository;
import com.example.shop.modules.messaging.cart.CartAbandonedEvent;
import com.example.shop.modules.messaging.cart.CartAbandonedEventPublisher;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.RedisConnectionFailureException;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;
import java.util.concurrent.TimeUnit;

@Service
@RequiredArgsConstructor
@Slf4j
public class CartAbandonmentReminderService {

    private final CartItemRepository cartItemRepository;
    private final StringRedisTemplate redisTemplate;
    private final CartAbandonedEventPublisher eventPublisher;

    @Value("${application.cart.reminder.enabled:true}")
    private boolean enabled;

    @Value("${application.cart.reminder.idle-minutes:120}")
    private long idleMinutes;

    @Value("${application.cart.reminder.cooldown-hours:24}")
    private long cooldownHours;

    @Scheduled(fixedDelayString = "${application.cart.reminder.fixed-delay-ms:900000}")
    public void processAbandonedCarts() {
        if (!enabled) {
            return;
        }

        LocalDateTime cutoff = LocalDateTime.now().minusMinutes(Math.max(1L, idleMinutes));
        List<AbandonedCartCandidateProjection> candidates = cartItemRepository.findAbandonedCartCandidates(cutoff);

        for (AbandonedCartCandidateProjection candidate : candidates) {
            if (candidate.getUserId() == null || candidate.getEmail() == null || candidate.getEmail().isBlank()) {
                continue;
            }
            if (!shouldNotify(candidate.getUserId().toString())) {
                continue;
            }

            eventPublisher.publish(CartAbandonedEvent.builder()
                    .userId(candidate.getUserId())
                    .email(candidate.getEmail())
                    .firstName(candidate.getFirstName())
                    .itemCount(candidate.getItemCount())
                    .totalQuantity(candidate.getTotalQuantity())
                    .lastActivityAt(candidate.getLastActivityAt())
                    .queuedAt(LocalDateTime.now())
                    .build());
        }
    }

    private boolean shouldNotify(String userId) {
        String key = "cart:abandon:reminder:sent:" + userId;
        try {
            Boolean added = redisTemplate.opsForValue().setIfAbsent(
                    key,
                    "1",
                    Math.max(1L, cooldownHours),
                    TimeUnit.HOURS
            );
            return Boolean.TRUE.equals(added);
        } catch (RedisConnectionFailureException ex) {
            log.warn("Skip abandoned cart reminder because Redis is unavailable: {}", ex.getMessage());
            return false;
        }
    }
}
