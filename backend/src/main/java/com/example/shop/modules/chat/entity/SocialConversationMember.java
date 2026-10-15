package com.example.shop.modules.chat.entity;

import jakarta.persistence.Column;
import jakarta.persistence.EmbeddedId;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;

@Entity
@Table(name = "social_conversation_members")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class SocialConversationMember {

    @EmbeddedId
    private SocialConversationMemberId id;

    @Builder.Default
    @Column(name = "role", length = 24, nullable = false)
    private String role = "member";

    @Builder.Default
    @Column(name = "joined_at", nullable = false)
    private LocalDateTime joinedAt = LocalDateTime.now();

    @Column(name = "last_read_message_id", length = 64)
    private String lastReadMessageId;

    @Column(name = "last_read_at")
    private LocalDateTime lastReadAt;

    @Column(name = "muted_until")
    private LocalDateTime mutedUntil;

    @Builder.Default
    @Column(name = "mention_unread_count", nullable = false)
    private Integer mentionUnreadCount = 0;

    @Builder.Default
    @Column(name = "message_unread_count", nullable = false)
    private Integer messageUnreadCount = 0;

    @Builder.Default
    @Column(name = "is_online", nullable = false)
    private Boolean isOnline = false;

    @Column(name = "last_seen_at")
    private LocalDateTime lastSeenAt;

    @Column(name = "deleted_at")
    private LocalDateTime deletedAt;
}
