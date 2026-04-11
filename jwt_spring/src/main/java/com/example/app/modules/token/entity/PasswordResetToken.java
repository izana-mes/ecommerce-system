package com.example.app.modules.token.entity;

import com.example.app.modules.user.entity.User;
import jakarta.persistence.*;
import lombok.*;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import java.time.LocalDateTime;
import java.util.UUID;

/**
 * Password reset token entity.
 *
 * What this class does:
 * - One-time token sent via email when user requests password reset
 * - Short-lived (e.g. 1 hour) for security
 * - Stored as hash; raw token sent in email
 *
 * Why it exists:
 * - Allows password reset without knowing current password
 * - Proves user controls the email
 *
 * Lifecycle: Created on forgot-password -> Sent in email -> User resets -> Marked used
 */
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "password_reset_tokens")
@EntityListeners(AuditingEntityListener.class)
public class PasswordResetToken {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "password_reset_tokens_id")
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "users_id", nullable = false)
    private User user;

    @Column(name = "tokens_hash", nullable = false, columnDefinition = "TEXT")
    private String tokenHash;

    @Column(name = "is_used")
    @Builder.Default
    private boolean isUsed = false;

    @Column(name = "expires_at", nullable = false)
    private LocalDateTime expiresAt;

    @CreatedDate
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;
}
