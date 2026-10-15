package com.example.shop.modules.notification.service;

import com.example.shop.modules.notification.entity.CustomerNotification;
import com.example.shop.modules.notification.repository.CustomerNotificationRepository;
import com.example.shop.modules.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.LocalDateTime;
import java.util.Map;
import java.util.UUID;

@Service @RequiredArgsConstructor
public class CustomerNotificationService {
    private final CustomerNotificationRepository repository;
    private final UserRepository users;
    private final SimpMessagingTemplate messaging;
    private final JdbcTemplate jdbcTemplate;

    @Transactional
    public void createForEmail(String email, String dedupeKey, String category, String title, String message, String url) {
        if (email == null || dedupeKey == null || dedupeKey.length() > 200) return;
        users.findByEmailIgnoreCase(email).ifPresent(user -> {
            int inserted = jdbcTemplate.update("""
                    INSERT INTO customer_notifications (user_id, dedupe_key, category, title, message, target_url, created_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                    ON CONFLICT (dedupe_key) DO NOTHING
                    """, user.getId(), dedupeKey, category, title, message, url, LocalDateTime.now());
            if (inserted == 1) messaging.convertAndSend("/topic/customer-notifications/" + user.getId(), Map.of("id", dedupeKey));
        });
    }

    @Transactional
    public void createForUser(UUID userId, String dedupeKey, String title, String message, String url) {
        if (userId == null || dedupeKey == null || dedupeKey.length() > 200) return;
        int inserted = jdbcTemplate.update("""
                INSERT INTO customer_notifications (user_id, dedupe_key, category, title, message, target_url, created_at)
                VALUES (?, ?, 'message', ?, ?, ?, ?)
                ON CONFLICT (dedupe_key) DO NOTHING
                """, userId, dedupeKey, title, message, url, LocalDateTime.now());
        if (inserted == 1) messaging.convertAndSend("/topic/customer-notifications/" + userId, Map.of("id", dedupeKey));
    }

    @Transactional
    public void markConversationMessagesRead(UUID userId, String conversationId) {
        jdbcTemplate.update("""
                UPDATE customer_notifications SET read_at = ?
                WHERE user_id = ? AND category = 'message' AND target_url = ? AND read_at IS NULL
                """, LocalDateTime.now(), userId, "/messages?conversationId=" + conversationId);
    }

    @Transactional(readOnly=true) public Map<String,Object> list(UUID userId) {
        return Map.of("items", repository.findTop100ByUserIdOrderByCreatedAtDesc(userId), "unreadCount", repository.countByUserIdAndReadAtIsNull(userId));
    }
    @Transactional public void markRead(Long id, UUID userId) {
        CustomerNotification item = repository.findByIdAndUserId(id,userId).orElseThrow(() -> new IllegalArgumentException("Notification not found"));
        if (item.getReadAt()==null) item.setReadAt(LocalDateTime.now());
    }
    @Transactional public void markUnread(Long id, UUID userId) {
        CustomerNotification item = repository.findByIdAndUserId(id,userId).orElseThrow(() -> new IllegalArgumentException("Notification not found"));
        item.setReadAt(null);
    }
    @Transactional public void markAllRead(UUID userId) {
        repository.markAllRead(userId, LocalDateTime.now());
    }
}
