package com.example.shop.modules.notification.repository;

import com.example.shop.modules.notification.entity.CustomerNotification;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface CustomerNotificationRepository extends JpaRepository<CustomerNotification, Long> {
    List<CustomerNotification> findTop100ByUserIdOrderByCreatedAtDesc(UUID userId);
    long countByUserIdAndReadAtIsNull(UUID userId);
    Optional<CustomerNotification> findByIdAndUserId(Long id, UUID userId);
    boolean existsByDedupeKey(String dedupeKey);
    @Modifying @Query("update CustomerNotification n set n.readAt = :now where n.userId = :userId and n.readAt is null")
    int markAllRead(@Param("userId") UUID userId, @Param("now") LocalDateTime now);
}
