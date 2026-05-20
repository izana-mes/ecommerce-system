package com.example.shop.modules.token.service;

import com.example.shop.common.exception.BusinessException;
import com.example.shop.common.util.HashUtil;
import com.example.shop.modules.auth.security.AccessTokenRevocationService;
import com.example.shop.modules.auth.security.AuthAbuseProtectionService;
import com.example.shop.modules.security.SecurityEventLogger;
import com.example.shop.modules.token.dto.response.ActiveSessionResponse;
import com.example.shop.modules.token.dto.response.RefreshTokenResponse;
import com.example.shop.modules.token.entity.EmailVerificationToken;
import com.example.shop.modules.token.entity.PasswordResetToken;
import com.example.shop.modules.token.entity.RefreshToken;
import com.example.shop.modules.token.entity.RefreshTokenRevocationReason;
import com.example.shop.modules.token.repository.EmailVerificationTokenRepository;
import com.example.shop.modules.token.repository.PasswordResetTokenRepository;
import com.example.shop.modules.token.repository.RefreshTokenRepository;
import com.example.shop.modules.user.entity.User;
import com.example.shop.modules.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class TokenService {

    private final RefreshTokenRepository refreshTokenRepository;
    private final EmailVerificationTokenRepository emailVerificationTokenRepository;
    private final PasswordResetTokenRepository passwordResetTokenRepository;
    private final UserRepository userRepository;
    private final SecurityEventLogger securityEventLogger;
    private final AuthAbuseProtectionService abuseProtectionService;
    private final AccessTokenRevocationService accessTokenRevocationService;

    @Value("${application.security.jwt.refresh-token.expiration}")
    private long refreshExpiration;

    @Value("${application.security.jwt.email-verification.expiration:86400000}")
    private long emailVerificationExpiration;

    @Value("${application.security.jwt.password-reset.expiration:3600000}")
    private long passwordResetExpiration;

    public record RefreshIssueResult(RefreshToken tokenEntity, String rawToken) {
    }

    @Transactional
    public RefreshIssueResult createRefreshToken(User user, SessionClientMetadata metadata) {
        String rawToken = HashUtil.generateSecureToken();
        String tokenHash = HashUtil.hash(rawToken);
        LocalDateTime now = LocalDateTime.now();

        RefreshToken refreshToken = RefreshToken.builder()
                .user(user)
                .tokenHash(tokenHash)
                .tokenFamilyId(UUID.randomUUID())
                .parentTokenId(null)
                .replacedByTokenId(null)
                .issuedAt(now)
                .expiresAt(now.plusSeconds(refreshExpiration / 1000))
                .isRevoked(false)
                .issuedIp(trim(metadata.ipAddress(), 128))
                .issuedUserAgent(trim(metadata.userAgent(), 1024))
                .deviceId(trim(metadata.deviceId(), 256))
                .build();

        return new RefreshIssueResult(refreshTokenRepository.save(refreshToken), rawToken);
    }

    @Transactional
    public RefreshIssueResult verifyAndRotateRefreshToken(String rawToken, SessionClientMetadata metadata) {
        abuseProtectionService.assertRefreshAllowed("unknown", metadata.ipAddress());
        if (rawToken == null || rawToken.isBlank()) {
            abuseProtectionService.recordRefreshFailure("unknown", metadata.ipAddress());
            throw new BusinessException("Refresh token missing", HttpStatus.FORBIDDEN);
        }

        String tokenHash = HashUtil.hash(rawToken);
        RefreshToken current = refreshTokenRepository.findByTokenHashForUpdate(tokenHash)
                .orElseThrow(() -> new BusinessException("Refresh token not found", HttpStatus.FORBIDDEN));

        LocalDateTime now = LocalDateTime.now();
        String userKey = current.getUser() == null ? "unknown" : current.getUser().getId().toString();
        abuseProtectionService.assertRefreshAllowed(userKey, metadata.ipAddress());

        if (current.isRevoked()) {
            abuseProtectionService.recordRefreshReuse(userKey, metadata.ipAddress());
            onRefreshReuseDetected(current, metadata, now, "revoked_token_reused");
            throw new BusinessException("Refresh token has been revoked", HttpStatus.FORBIDDEN);
        }
        if (current.getExpiresAt().isBefore(now)) {
            abuseProtectionService.recordRefreshFailure(userKey, metadata.ipAddress());
            current.setRevoked(true);
            current.setRevokedAt(now);
            current.setRevocationReason(RefreshTokenRevocationReason.EXPIRED);
            refreshTokenRepository.save(current);
            throw new BusinessException("Refresh token expired", HttpStatus.FORBIDDEN);
        }

        User user = current.getUser();
        if (user == null || !user.isActive()) {
            abuseProtectionService.recordRefreshFailure(userKey, metadata.ipAddress());
            revokeTokenFamily(current.getTokenFamilyId(), RefreshTokenRevocationReason.USER_DEACTIVATED, now, now, metadata);
            throw new BusinessException("User account is deactivated", HttpStatus.FORBIDDEN);
        }

        String nextRawToken = HashUtil.generateSecureToken();
        String nextHash = HashUtil.hash(nextRawToken);

        RefreshToken rotated = RefreshToken.builder()
                .user(user)
                .tokenHash(nextHash)
                .tokenFamilyId(current.getTokenFamilyId())
                .parentTokenId(current.getId())
                .issuedAt(now)
                .expiresAt(now.plusSeconds(refreshExpiration / 1000))
                .isRevoked(false)
                .issuedIp(trim(metadata.ipAddress(), 128))
                .issuedUserAgent(trim(metadata.userAgent(), 1024))
                .deviceId(trim(metadata.deviceId(), 256))
                .build();

        RefreshToken savedRotated = refreshTokenRepository.save(rotated);

        current.setRevoked(true);
        current.setRevokedAt(now);
        current.setRevocationReason(RefreshTokenRevocationReason.ROTATED);
        current.setReplacedByTokenId(savedRotated.getId());
        current.setLastUsedAt(now);
        refreshTokenRepository.save(current);

        securityEventLogger.info("refresh_success", Map.of(
                "userId", String.valueOf(user.getId()),
                "sessionId", String.valueOf(current.getId()),
                "nextSessionId", String.valueOf(savedRotated.getId()),
                "tokenFamilyId", String.valueOf(current.getTokenFamilyId()),
                "ip", safe(metadata.ipAddress()),
                "deviceId", safe(metadata.deviceId()),
                "requestId", safe(metadata.requestId())
        ));
        abuseProtectionService.recordRefreshSuccess(user.getId().toString(), metadata.ipAddress());

        return new RefreshIssueResult(savedRotated, nextRawToken);
    }

    private void onRefreshReuseDetected(RefreshToken token, SessionClientMetadata metadata, LocalDateTime now, String reason) {
        revokeTokenFamily(token.getTokenFamilyId(), RefreshTokenRevocationReason.REUSE_DETECTED, now, now, metadata);
        securityEventLogger.warn("refresh_reuse_detected", Map.of(
                "userId", String.valueOf(token.getUser().getId()),
                "sessionId", String.valueOf(token.getId()),
                "tokenFamilyId", String.valueOf(token.getTokenFamilyId()),
                "ip", safe(metadata.ipAddress()),
                "deviceId", safe(metadata.deviceId()),
                "requestId", safe(metadata.requestId()),
                "reason", reason
        ));
    }

    private void revokeTokenFamily(UUID familyId, RefreshTokenRevocationReason reason, LocalDateTime revokedAt, LocalDateTime reuseDetectedAt, SessionClientMetadata metadata) {
        refreshTokenRepository.revokeTokenFamily(familyId, revokedAt, reuseDetectedAt, reason);
        accessTokenRevocationService.revokeFamilyAccessTokens(
                String.valueOf(familyId),
                reason == RefreshTokenRevocationReason.REUSE_DETECTED ? "SECURITY_COMPROMISE" : "FAMILY_REVOKED",
                metadata == null ? null : metadata.requestId()
        );
        securityEventLogger.warn("forced_logout_propagated", Map.of(
                "scope", "family",
                "familyId", String.valueOf(familyId),
                "reason", reason.name(),
                "requestId", metadata == null ? "" : safe(metadata.requestId())
        ));
    }

    @Transactional
    public void revokeRefreshToken(User user, RefreshTokenRevocationReason reason, SessionClientMetadata metadata) {
        LocalDateTime now = LocalDateTime.now();
        refreshTokenRepository.findByUser_IdAndIsRevokedFalse(user.getId()).forEach(token -> {
            token.setRevoked(true);
            token.setRevokedAt(now);
            token.setRevocationReason(reason);
            refreshTokenRepository.save(token);
        });
        accessTokenRevocationService.revokeUserAccessTokens(
                String.valueOf(user.getId()),
                reason == RefreshTokenRevocationReason.PASSWORD_RESET ? "PASSWORD_RESET" : "USER_REVOKED",
                metadata == null ? null : metadata.requestId()
        );
        securityEventLogger.warn("forced_logout_propagated", Map.of(
                "scope", "user",
                "userId", String.valueOf(user.getId()),
                "reason", reason.name(),
                "requestId", metadata == null ? "" : safe(metadata.requestId())
        ));
    }

    @Transactional
    public void revokeRefreshToken(User user) {
        revokeRefreshToken(user, RefreshTokenRevocationReason.LOGOUT_ALL, null);
    }

    @Transactional
    public void revokeRefreshTokenValue(String refreshToken, RefreshTokenRevocationReason reason, SessionClientMetadata metadata) {
        if (refreshToken == null || refreshToken.isBlank()) {
            return;
        }
        String hash = HashUtil.hash(refreshToken);
        refreshTokenRepository.findByTokenHash(hash).ifPresent(token -> {
            token.setRevoked(true);
            token.setRevokedAt(LocalDateTime.now());
            token.setRevocationReason(reason);
            refreshTokenRepository.save(token);
            accessTokenRevocationService.revokeSessionAccessTokens(
                    String.valueOf(token.getId()),
                    "SESSION_REVOKED",
                    metadata == null ? null : metadata.requestId()
            );
            securityEventLogger.warn("forced_logout_propagated", Map.of(
                    "scope", "session",
                    "sessionId", String.valueOf(token.getId()),
                    "tokenFamilyId", String.valueOf(token.getTokenFamilyId()),
                    "userId", String.valueOf(token.getUser().getId()),
                    "reason", reason.name(),
                    "requestId", metadata == null ? "" : safe(metadata.requestId())
            ));
        });
    }

    @Transactional
    public void revokeRefreshTokenValue(String refreshToken) {
        revokeRefreshTokenValue(refreshToken, RefreshTokenRevocationReason.LOGOUT, null);
    }

    @Transactional
    public String createEmailVerificationToken(User user) {
        String token = UUID.randomUUID().toString();
        String tokenHash = HashUtil.hash(token);
        EmailVerificationToken verificationToken = EmailVerificationToken.builder()
                .user(user)
                .tokenHash(tokenHash)
                .expiresAt(LocalDateTime.now().plusSeconds(emailVerificationExpiration / 1000))
                .isUsed(false)
                .build();
        emailVerificationTokenRepository.save(verificationToken);
        return token;
    }

    public EmailVerificationToken verifyEmailToken(String token) {
        String tokenHash = HashUtil.hash(token);
        EmailVerificationToken verificationToken = emailVerificationTokenRepository.findByTokenHash(tokenHash)
                .orElseThrow(() -> new BusinessException("Invalid email verification token", HttpStatus.BAD_REQUEST));
        if (verificationToken.isUsed()) {
            throw new BusinessException("Token already used", HttpStatus.BAD_REQUEST);
        }
        if (verificationToken.getExpiresAt().isBefore(LocalDateTime.now())) {
            throw new BusinessException("Token expired", HttpStatus.BAD_REQUEST);
        }
        return verificationToken;
    }

    @Transactional
    public void markEmailTokenAsUsed(EmailVerificationToken token) {
        token.setUsed(true);
        emailVerificationTokenRepository.save(token);
    }

    @Transactional
    public String createPasswordResetToken(User user) {
        String token = UUID.randomUUID().toString();
        String tokenHash = HashUtil.hash(token);
        PasswordResetToken resetToken = PasswordResetToken.builder()
                .user(user)
                .tokenHash(tokenHash)
                .expiresAt(LocalDateTime.now().plusSeconds(passwordResetExpiration / 1000))
                .isUsed(false)
                .build();
        passwordResetTokenRepository.save(resetToken);
        return token;
    }

    public PasswordResetToken verifyPasswordResetToken(String token) {
        String tokenHash = HashUtil.hash(token);
        PasswordResetToken resetToken = passwordResetTokenRepository.findByTokenHash(tokenHash)
                .orElseThrow(() -> new BusinessException("Invalid password reset token", HttpStatus.BAD_REQUEST));
        if (resetToken.isUsed()) {
            throw new BusinessException("Token already used", HttpStatus.BAD_REQUEST);
        }
        if (resetToken.getExpiresAt().isBefore(LocalDateTime.now())) {
            throw new BusinessException("Token expired", HttpStatus.BAD_REQUEST);
        }
        return resetToken;
    }

    @Transactional
    public void markPasswordResetTokenAsUsed(PasswordResetToken token) {
        token.setUsed(true);
        passwordResetTokenRepository.save(token);
    }

    @Transactional(readOnly = true)
    public List<ActiveSessionResponse> getUserSessions(String email, String currentRefreshToken) {
        User user = userRepository.findByEmailIgnoreCase(email)
                .orElseThrow(() -> new BusinessException("User not found", HttpStatus.NOT_FOUND));

        String currentHash = (currentRefreshToken == null || currentRefreshToken.isBlank())
                ? null
                : HashUtil.hash(currentRefreshToken);

        return refreshTokenRepository.findByUser_IdAndIsRevokedFalse(user.getId()).stream()
                .filter(t -> t.getExpiresAt().isAfter(LocalDateTime.now()))
                .map(t -> ActiveSessionResponse.fromEntity(t, currentHash != null && HashUtil.constantTimeEquals(t.getTokenHash(), currentHash)))
                .collect(Collectors.toList());
    }

    @Transactional
    public void revokeSession(String email, UUID sessionId) {
        User user = userRepository.findByEmailIgnoreCase(email)
                .orElseThrow(() -> new BusinessException("User not found", HttpStatus.NOT_FOUND));

        RefreshToken token = refreshTokenRepository.findById(sessionId)
                .orElseThrow(() -> new BusinessException("Session not found", HttpStatus.NOT_FOUND));

        if (!token.getUser().getId().equals(user.getId())) {
            throw new BusinessException("Session not found", HttpStatus.NOT_FOUND);
        }

        token.setRevoked(true);
        token.setRevokedAt(LocalDateTime.now());
        token.setRevocationReason(RefreshTokenRevocationReason.LOGOUT);
        refreshTokenRepository.save(token);
        accessTokenRevocationService.revokeSessionAccessTokens(
                String.valueOf(token.getId()),
                "SESSION_REVOKED",
                null
        );
    }

    @Transactional
    public void revokeAllSessionsExceptCurrent(String email, String currentRefreshToken) {
        User user = userRepository.findByEmailIgnoreCase(email)
                .orElseThrow(() -> new BusinessException("User not found", HttpStatus.NOT_FOUND));

        String currentHash = (currentRefreshToken == null || currentRefreshToken.isBlank())
                ? null
                : HashUtil.hash(currentRefreshToken);

        refreshTokenRepository.findByUser_IdAndIsRevokedFalse(user.getId()).stream()
                .filter(t -> currentHash == null || !HashUtil.constantTimeEquals(t.getTokenHash(), currentHash))
                .forEach(t -> {
                    t.setRevoked(true);
                    t.setRevokedAt(LocalDateTime.now());
                    t.setRevocationReason(RefreshTokenRevocationReason.LOGOUT_ALL);
                    refreshTokenRepository.save(t);
                    accessTokenRevocationService.revokeSessionAccessTokens(
                            String.valueOf(t.getId()),
                            "SESSION_REVOKED",
                            null
                    );
                });
    }

    @Transactional
    public void revokeAllUserSessions(UUID userId) {
        LocalDateTime now = LocalDateTime.now();
        refreshTokenRepository.findByUser_IdAndIsRevokedFalse(userId).forEach(t -> {
            t.setRevoked(true);
            t.setRevokedAt(now);
            t.setRevocationReason(RefreshTokenRevocationReason.ADMIN_REVOKED);
            refreshTokenRepository.save(t);
            accessTokenRevocationService.revokeSessionAccessTokens(
                    String.valueOf(t.getId()),
                    "SESSION_REVOKED",
                    null
            );
        });
        accessTokenRevocationService.revokeUserAccessTokens(
                String.valueOf(userId),
                "USER_REVOKED",
                null
        );
    }

    @Transactional(readOnly = true)
    public Page<RefreshTokenResponse> getAllActiveTokens(Pageable pageable) {
        return refreshTokenRepository.findByIsRevokedFalseAndExpiresAtAfter(LocalDateTime.now(), pageable)
                .map(RefreshTokenResponse::fromEntity);
    }

    @Transactional
    public void revokeTokenById(UUID tokenId) {
        RefreshToken token = refreshTokenRepository.findById(tokenId)
                .orElseThrow(() -> new BusinessException("Token not found", HttpStatus.NOT_FOUND));
        token.setRevoked(true);
        token.setRevokedAt(LocalDateTime.now());
        token.setRevocationReason(RefreshTokenRevocationReason.ADMIN_REVOKED);
        refreshTokenRepository.save(token);
        accessTokenRevocationService.revokeSessionAccessTokens(
                String.valueOf(token.getId()),
                "SESSION_REVOKED",
                null
        );
    }

    private String trim(String value, int max) {
        if (value == null) return null;
        String v = value.trim();
        if (v.length() <= max) return v;
        return v.substring(0, max);
    }

    private String safe(String value) {
        return value == null ? "" : value;
    }
}
