package com.example.shop.modules.supportchat.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;

@Entity
@Table(name = "support_chat_conversations")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class SupportChatConversation {

    @Id
    @Column(name = "conversation_id", length = 64, nullable = false)
    private String conversationId;

    @Column(name = "customer_user_id", length = 64)
    private String customerUserId;

    @Column(name = "customer_email", length = 255)
    private String customerEmail;

    @Column(name = "guest_id", length = 128)
    private String guestId;

    @Builder.Default
    @Column(name = "status", length = 16, nullable = false)
    private String status = "open";

    @Builder.Default
    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt = LocalDateTime.now();

    @Builder.Default
    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt = LocalDateTime.now();

    @Builder.Default
    @Column(name = "last_message_at", nullable = false)
    private LocalDateTime lastMessageAt = LocalDateTime.now();
}
