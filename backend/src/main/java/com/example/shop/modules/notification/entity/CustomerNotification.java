package com.example.shop.modules.notification.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "customer_notifications", uniqueConstraints = @UniqueConstraint(name = "uq_customer_notification_dedupe", columnNames = "dedupe_key"), indexes = @Index(name = "idx_customer_notification_user_created", columnList = "user_id, created_at"))
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class CustomerNotification {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) private Long id;
    @Column(name="user_id", nullable=false) private UUID userId;
    @Column(name="dedupe_key", nullable=false, length=200) private String dedupeKey;
    @Column(nullable=false, length=32) private String category;
    @Column(nullable=false, length=160) private String title;
    @Column(nullable=false, columnDefinition="TEXT") private String message;
    @Column(name="target_url", length=300) private String targetUrl;
    @Column(name="created_at", nullable=false) private LocalDateTime createdAt;
    @Column(name="read_at") private LocalDateTime readAt;
}
