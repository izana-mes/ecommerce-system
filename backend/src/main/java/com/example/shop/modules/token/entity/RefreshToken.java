package com.example.shop.modules.token.entity;

import com.example.shop.modules.user.entity.User;
import jakarta.persistence.*;
import lombok.*;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import java.time.LocalDateTime;
import java.util.UUID;

/**
 * Refresh token entity - long-lived token to obtain new access tokens.
 *
 * What this class does:
 * - Stores opaque refresh tokens (UUID) linked to a user
 * - Allows clients to get new access tokens without re-login
 * - Tracks revocation and expiration
 *
 * Why it exists:
 * - Access tokens are short-lived (e.g. 24h) for security
 * - Refresh tokens (e.g. 7 days) provide better UX
 * - Stored in DB so we can revoke them (logout, password reset)
 */
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "refresh_tokens")
@EntityListeners(AuditingEntityListener.class)
public class RefreshToken {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "refresh_tokens_id")
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "users_id", nullable = false)
    private User user;

    @Column(name = "refresh_tokens_hash", nullable = false, unique = true, columnDefinition = "TEXT")
    private String tokenHash;

    @Column(name = "token_family_id", nullable = false)
    private UUID tokenFamilyId;

    @Column(name = "parent_token_id")
    private UUID parentTokenId;

    @Column(name = "replaced_by_token_id")
    private UUID replacedByTokenId;

    @Column(name = "is_revoked")
    @Builder.Default
    private boolean isRevoked = false;

    @Column(name = "issued_at", nullable = false)
    private LocalDateTime issuedAt;

    @Column(name = "expires_at", nullable = false)
    private LocalDateTime expiresAt;

    @Column(name = "revoked_at")
    private LocalDateTime revokedAt;

    @Column(name = "reuse_detected_at")
    private LocalDateTime reuseDetectedAt;

    @Enumerated(EnumType.STRING)
    @Column(name = "revocation_reason")
    private RefreshTokenRevocationReason revocationReason;

    @Column(name = "last_used_at")
    private LocalDateTime lastUsedAt;

    @Column(name = "issued_ip", length = 128)
    private String issuedIp;

    @Column(name = "issued_user_agent", length = 1024)
    private String issuedUserAgent;

    @Column(name = "device_id", length = 256)
    private String deviceId;

    @Version
    @Column(name = "entity_version", nullable = false)
    @Builder.Default
    private long version = 0L;

    @CreatedDate
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;
}
