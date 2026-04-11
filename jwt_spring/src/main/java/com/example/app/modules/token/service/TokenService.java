package com.example.app.modules.token.service;

import com.example.app.common.exception.BusinessException;
import com.example.app.common.util.HashUtil;
import com.example.app.modules.token.dto.response.ActiveSessionResponse;
import com.example.app.modules.token.dto.response.RefreshTokenResponse;
import com.example.app.modules.token.entity.EmailVerificationToken;
import com.example.app.modules.token.entity.PasswordResetToken;
import com.example.app.modules.token.entity.RefreshToken;
import com.example.app.modules.token.repository.EmailVerificationTokenRepository;
import com.example.app.modules.token.repository.PasswordResetTokenRepository;
import com.example.app.modules.token.repository.RefreshTokenRepository;
import com.example.app.modules.user.entity.User;
import com.example.app.modules.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * Service for managing all token types: refresh, email verification, password reset.
 *
 * What this class does:
 * - Creates, validates, and revokes tokens
 * - No business logic beyond token lifecycle
 * - Uses HashUtil to hash tokens before storing (except refresh - stored as-is for lookup)
 *
 * Why it exists:
 * - Single responsibility: token management
 * - Decouples AuthService from token storage details
 *
 * @Transactional: All methods that modify DB are transactional
 */
@Service
@RequiredArgsConstructor
public class TokenService {

    private final RefreshTokenRepository refreshTokenRepository;
    private final EmailVerificationTokenRepository emailVerificationTokenRepository;
    private final PasswordResetTokenRepository passwordResetTokenRepository;
    private final UserRepository userRepository;

    @Value("${application.security.jwt.refresh-token.expiration}")
    private long refreshExpiration;

    @Value("${application.security.jwt.email-verification.expiration:86400000}")
    private long emailVerificationExpiration;

    @Value("${application.security.jwt.password-reset.expiration:3600000}")
    private long passwordResetExpiration;

    @Transactional
    public RefreshToken createRefreshToken(User user) {
        refreshTokenRepository.deleteByUser_Id(user.getId());

        String token = UUID.randomUUID().toString();
        RefreshToken refreshToken = RefreshToken.builder()
                .user(user)
                .refreshTokenHash(token)
                .expiresAt(LocalDateTime.now().plusSeconds(refreshExpiration / 1000))
                .isRevoked(false)
                .build();
        return refreshTokenRepository.save(refreshToken);
    }

    public RefreshToken verifyRefreshToken(String token) {
        RefreshToken refreshToken = refreshTokenRepository.findByRefreshTokenHash(token)
                .orElseThrow(() -> new BusinessException("Refresh token not found", HttpStatus.FORBIDDEN));
        if (refreshToken.isRevoked()) {
            throw new BusinessException("Refresh token has been revoked", HttpStatus.FORBIDDEN);
        }
        if (refreshToken.getExpiresAt().isBefore(LocalDateTime.now())) {
            refreshTokenRepository.delete(refreshToken);
            throw new BusinessException("Refresh token expired", HttpStatus.FORBIDDEN);
        }
        refreshToken.setLastUsedAt(LocalDateTime.now());
        return refreshTokenRepository.save(refreshToken);
    }

    @Transactional
    public void revokeRefreshToken(User user) {
        refreshTokenRepository.deleteByUser_Id(user.getId());
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

    // ==================== SESSION MANAGEMENT ====================

    /**
     * Get all active sessions for current user.
     */
    @Transactional(readOnly = true)
    public List<ActiveSessionResponse> getUserSessions(String email, String currentToken) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new BusinessException("User not found", HttpStatus.NOT_FOUND));

        return refreshTokenRepository.findByUser_IdAndIsRevokedFalse(user.getId()).stream()
                .filter(t -> t.getExpiresAt().isAfter(LocalDateTime.now()))
                .map(t -> ActiveSessionResponse.fromEntity(t, t.getRefreshTokenHash().equals(currentToken)))
                .collect(Collectors.toList());
    }

    /**
     * Revoke a specific session (logout from device).
     */
    @Transactional
    public void revokeSession(String email, UUID sessionId) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new BusinessException("User not found", HttpStatus.NOT_FOUND));

        RefreshToken token = refreshTokenRepository.findById(sessionId)
                .orElseThrow(() -> new BusinessException("Session not found", HttpStatus.NOT_FOUND));

        // Ensure user can only revoke their own sessions
        if (!token.getUser().getId().equals(user.getId())) {
            throw new BusinessException("Session not found", HttpStatus.NOT_FOUND);
        }

        token.setRevoked(true);
        refreshTokenRepository.save(token);
    }

    /**
     * Revoke all sessions except current (logout from all devices).
     */
    @Transactional
    public void revokeAllSessionsExceptCurrent(String email, String currentToken) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new BusinessException("User not found", HttpStatus.NOT_FOUND));

        refreshTokenRepository.findByUser_IdAndIsRevokedFalse(user.getId()).stream()
                .filter(t -> !t.getRefreshTokenHash().equals(currentToken))
                .forEach(t -> {
                    t.setRevoked(true);
                    refreshTokenRepository.save(t);
                });
    }

    /**
     * Revoke all sessions for user (admin or logout from all).
     */
    @Transactional
    public void revokeAllUserSessions(UUID userId) {
        refreshTokenRepository.deleteByUser_Id(userId);
    }

    // ==================== ADMIN TOKEN MANAGEMENT ====================

    /**
     * Get all active refresh tokens (admin only).
     */
    @Transactional(readOnly = true)
    public Page<RefreshTokenResponse> getAllActiveTokens(Pageable pageable) {
        return refreshTokenRepository.findByIsRevokedFalseAndExpiresAtAfter(LocalDateTime.now(), pageable)
                .map(RefreshTokenResponse::fromEntity);
    }

    /**
     * Revoke refresh token by ID (admin only).
     */
    @Transactional
    public void revokeTokenById(UUID tokenId) {
        RefreshToken token = refreshTokenRepository.findById(tokenId)
                .orElseThrow(() -> new BusinessException("Token not found", HttpStatus.NOT_FOUND));
        token.setRevoked(true);
        refreshTokenRepository.save(token);
    }
}
