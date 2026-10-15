package com.example.shop.modules.chat.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.LocalDateTime;

@Entity
@Table(name = "social_conversations")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class SocialConversation {

    @Id
    @Column(name = "conversation_id", length = 64, nullable = false)
    private String conversationId;

    @Column(name = "type", length = 16, nullable = false)
    private String type; // direct, group, support, order

    @Column(name = "title", length = 160)
    private String title;

    @Column(name = "avatar_url", columnDefinition = "TEXT")
    private String avatarUrl;

    @Column(name = "order_id", length = 64)
    private String orderId;

    @Column(name = "created_by_user_id", length = 64)
    private String createdByUserId;

    @Builder.Default
    @Column(name = "status", length = 24, nullable = false)
    private String status = "active";

    @Column(name = "last_message_id", length = 64)
    private String lastMessageId;

    @Column(name = "last_message_at")
    private LocalDateTime lastMessageAt;

    @Column(name = "pinned_message_id", length = 64)
    private String pinnedMessageId;

    @Builder.Default
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "metadata", columnDefinition = "JSONB")
    private String metadata = "{}";

    @Builder.Default
    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt = LocalDateTime.now();

    @Builder.Default
    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt = LocalDateTime.now();

    @Column(name = "deleted_at")
    private LocalDateTime deletedAt;
}
