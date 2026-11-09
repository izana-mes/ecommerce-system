package com.example.shop.modules.notification.service;

import com.example.shop.common.exception.BusinessException;
import com.example.shop.modules.notification.entity.CustomerNotification;
import com.example.shop.modules.notification.repository.CustomerNotificationRepository;
import com.example.shop.modules.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class CustomerNotificationService {

    private final CustomerNotificationRepository repository;
    private final UserRepository users;
    private final SimpMessagingTemplate messaging;
    private final JdbcTemplate jdbcTemplate;

    @Value("${application.bootstrap.admin.email:admin@example.com}")
    private String adminEmail;

    @Transactional
    public void createForEmail(String email, String dedupeKey, String category, String title, String message, String url) {
        createForEmail(email, dedupeKey, category, title, message, url, null);
    }

    @Transactional
    public void createForEmail(String email, String dedupeKey, String category, String title, String message, String url, String relatedEntityId) {
        if (email == null || dedupeKey == null || dedupeKey.length() > 200) return;
        users.findByEmailIgnoreCase(email).ifPresent(user -> {
            createForUser(user.getId(), dedupeKey, category, title, message, url, relatedEntityId);
        });
    }

    @Transactional
    public void createForUser(UUID userId, String dedupeKey, String title, String message, String url) {
        createForUser(userId, dedupeKey, "message", title, message, url, null);
    }

    @Transactional
    public void createForUser(UUID userId, String dedupeKey, String category, String title, String message, String url) {
        createForUser(userId, dedupeKey, category, title, message, url, null);
    }

    @Transactional
    public void createForUser(UUID userId, String dedupeKey, String category, String title, String message, String url, String relatedEntityId) {
        if (userId == null || dedupeKey == null || dedupeKey.length() > 200) return;
        String safeCat = (category == null || category.isBlank()) ? "system" : category.toLowerCase();
        try {
            int inserted = jdbcTemplate.update("""
                    INSERT INTO customer_notifications (user_id, dedupe_key, category, title, message, target_url, related_entity_id, created_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                    ON CONFLICT (dedupe_key) DO NOTHING
                    """, userId, dedupeKey, safeCat, title, message, url, relatedEntityId, LocalDateTime.now());
            if (inserted == 1) {
                messaging.convertAndSend("/topic/customer-notifications/" + userId, Map.of(
                        "id", dedupeKey,
                        "category", safeCat,
                        "title", title,
                        "url", url != null ? url : ""
                ));
            }
        } catch (Exception ex) {
            log.error("Failed to insert notification for user {}: {}", userId, ex.getMessage());
        }
    }

    @Transactional
    public void notifyAdmins(String dedupeKeyPrefix, String category, String title, String message, String url, String relatedEntityId) {
        List<UUID> adminIds = new ArrayList<>(jdbcTemplate.queryForList("""
                SELECT DISTINCT u.users_id FROM users u
                JOIN user_roles ur ON ur.users_id = u.users_id
                JOIN roles r ON r.roles_id = ur.roles_id
                WHERE r.roles_name = 'ROLE_ADMIN'
                """, UUID.class));
        if (adminIds.isEmpty()) {
            users.findByEmailIgnoreCase(adminEmail).ifPresent(admin -> adminIds.add(admin.getId()));
        }
        for (UUID adminId : adminIds) {
            createForUser(adminId, dedupeKeyPrefix + ":" + adminId, category, title, message, url, relatedEntityId);
        }
    }

    @Transactional
    public void markConversationMessagesRead(UUID userId, String conversationId) {
        jdbcTemplate.update("""
                UPDATE customer_notifications SET read_at = ?
                WHERE user_id = ? AND category = 'message' AND target_url = ? AND read_at IS NULL
                """, LocalDateTime.now(), userId, "/messages?conversationId=" + conversationId);
    }

    @Transactional(readOnly = true)
    public Map<String, Object> list(UUID userId) {
        return list(userId, null, null, null, null);
    }

    @Transactional(readOnly = true)
    public Map<String, Object> list(UUID userId, Integer page, Integer size, String category, String status) {
        long unreadCount = repository.countByUserIdAndReadAtIsNull(userId);
        if (page == null) {
            List<CustomerNotification> items = repository.findTop100ByUserIdOrderByCreatedAtDesc(userId);
            long total = repository.countByUserId(userId);
            return Map.of(
                    "items", items,
                    "content", items,
                    "unreadCount", unreadCount,
                    "totalElements", total,
                    "totalPages", 1,
                    "number", 0
            );
        }

        int pageNum = Math.max(0, page);
        int pageSize = size == null || size <= 0 ? 10 : Math.min(size, 100);
        Pageable pageable = PageRequest.of(pageNum, pageSize);

        boolean hasCategory = StringUtils.hasText(category) && !"all".equalsIgnoreCase(category);
        String normStatus = StringUtils.hasText(status) ? status.trim().toLowerCase() : "all";

        Page<CustomerNotification> pageResult;
        if (hasCategory) {
            String cat = category.trim().toLowerCase();
            if ("unread".equals(normStatus)) {
                pageResult = repository.findByUserIdAndCategoryIgnoreCaseAndReadAtIsNullOrderByCreatedAtDesc(userId, cat, pageable);
            } else if ("read".equals(normStatus)) {
                pageResult = repository.findByUserIdAndCategoryIgnoreCaseAndReadAtIsNotNullOrderByCreatedAtDesc(userId, cat, pageable);
            } else {
                pageResult = repository.findByUserIdAndCategoryIgnoreCaseOrderByCreatedAtDesc(userId, cat, pageable);
            }
        } else {
            if ("unread".equals(normStatus)) {
                pageResult = repository.findByUserIdAndReadAtIsNullOrderByCreatedAtDesc(userId, pageable);
            } else if ("read".equals(normStatus)) {
                pageResult = repository.findByUserIdAndReadAtIsNotNullOrderByCreatedAtDesc(userId, pageable);
            } else {
                pageResult = repository.findByUserIdOrderByCreatedAtDesc(userId, pageable);
            }
        }

        return Map.of(
                "items", pageResult.getContent(),
                "content", pageResult.getContent(),
                "unreadCount", unreadCount,
                "totalElements", pageResult.getTotalElements(),
                "totalPages", pageResult.getTotalPages(),
                "number", pageResult.getNumber(),
                "size", pageResult.getSize()
        );
    }

    @Transactional(readOnly = true)
    public long getUnreadCount(UUID userId) {
        return repository.countByUserIdAndReadAtIsNull(userId);
    }

    @Transactional(readOnly = true)
    public CustomerNotification getById(Long id, UUID userId) {
        return repository.findByIdAndUserId(id, userId)
                .orElseThrow(() -> new BusinessException("Notification not found", HttpStatus.NOT_FOUND));
    }

    @Transactional
    public void markRead(Long id, UUID userId) {
        CustomerNotification item = repository.findByIdAndUserId(id, userId)
                .orElseThrow(() -> new BusinessException("Notification not found", HttpStatus.NOT_FOUND));
        if (item.getReadAt() == null) {
            item.setReadAt(LocalDateTime.now());
        }
    }

    @Transactional
    public void markUnread(Long id, UUID userId) {
        CustomerNotification item = repository.findByIdAndUserId(id, userId)
                .orElseThrow(() -> new BusinessException("Notification not found", HttpStatus.NOT_FOUND));
        item.setReadAt(null);
    }

    @Transactional
    public void markAllRead(UUID userId) {
        repository.markAllRead(userId, LocalDateTime.now());
    }
}
