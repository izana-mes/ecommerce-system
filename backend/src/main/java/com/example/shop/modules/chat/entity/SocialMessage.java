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
@Table(name = "social_messages")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class SocialMessage {

    @Id
    @Column(name = "message_id", length = 64, nullable = false)
    private String messageId;

    @Column(name = "conversation_id", length = 64, nullable = false)
    private String conversationId;

    @Column(name = "sender_user_id", length = 64)
    private String senderUserId;

    @Builder.Default
    @Column(name = "sender_role", length = 24, nullable = false)
    private String senderRole = "customer";

    @Column(name = "body", columnDefinition = "TEXT")
    private String body;

    @Builder.Default
    @Column(name = "body_format", length = 16, nullable = false)
    private String bodyFormat = "plain";

    @Builder.Default
    @Column(name = "type", length = 24, nullable = false)
    private String type = "text";

    @Column(name = "reply_to_message_id", length = 64)
    private String replyToMessageId;

    @Column(name = "forwarded_from_message_id", length = 64)
    private String forwardedFromMessageId;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "link_preview", columnDefinition = "JSONB")
    private String linkPreview;

    @Builder.Default
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "metadata", columnDefinition = "JSONB")
    private String metadata = "{}";

    @Column(name = "edited_at")
    private LocalDateTime editedAt;

    @Column(name = "deleted_for_everyone_at")
    private LocalDateTime deletedForEveryoneAt;

    @Builder.Default
    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt = LocalDateTime.now();
}
