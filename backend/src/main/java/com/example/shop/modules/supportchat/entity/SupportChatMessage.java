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
@Table(name = "support_chat_messages")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class SupportChatMessage {

    @Id
    @Column(name = "message_id", length = 64, nullable = false)
    private String messageId;

    @Column(name = "conversation_id", length = 64, nullable = false)
    private String conversationId;

    @Column(name = "sender_role", length = 16, nullable = false)
    private String senderRole;

    @Column(name = "sender_email", length = 255)
    private String senderEmail;

    @Column(name = "body", columnDefinition = "TEXT", nullable = false)
    private String body;

    @Builder.Default
    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt = LocalDateTime.now();
}
