package com.example.shop.modules.auth.service;

import com.example.shop.common.exception.BusinessException;
import com.example.shop.common.exception.UnauthorizedException;
import com.example.shop.modules.auth.dto.request.LoginRequest;
import com.example.shop.modules.auth.dto.request.RegisterRequest;
import com.example.shop.modules.auth.dto.request.ResetPasswordRequest;
import com.example.shop.modules.auth.dto.request.VerifyOtpRequest;
import com.example.shop.modules.auth.dto.response.AuthenticationResponse;
import com.example.shop.modules.auth.security.AccessTokenRevocationService;
import com.example.shop.modules.auth.security.JwtProvider;
import com.example.shop.modules.auth.security.AuthAbuseProtectionService;
import com.example.shop.modules.messaging.email.EmailMessage;
import com.example.shop.modules.messaging.email.EmailMessagePublisher;
import com.example.shop.modules.otp.service.OtpService;
import com.example.shop.modules.role.entity.Role;
import com.example.shop.modules.role.repository.RoleRepository;
import com.example.shop.modules.security.SecurityEventLogger;
import com.example.shop.modules.token.entity.EmailVerificationToken;
import com.example.shop.modules.token.entity.PasswordResetToken;
import com.example.shop.modules.token.entity.RefreshTokenRevocationReason;
import com.example.shop.modules.token.service.SessionClientMetadata;
import com.example.shop.modules.token.service.TokenService;
import com.example.shop.modules.user.entity.User;
import com.example.shop.modules.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Locale;

@Service
@RequiredArgsConstructor
public class AuthServiceImpl implements AuthService {

    private final UserRepository userRepository;
    private final RoleRepository roleRepository;
    private final TokenService tokenService;
    private final EmailMessagePublisher emailMessagePublisher;
    private final OtpService otpService;
    private final JwtProvider jwtProvider;
    private final AuthenticationManager authenticationManager;
    private final PasswordEncoder passwordEncoder;
    private final SecurityEventLogger securityEventLogger;
    private final AuthAbuseProtectionService abuseProtectionService;
    private final AccessTokenRevocationService accessTokenRevocationService;

    @Value("${application.security.jwt.expiration}")
    private long jwtExpiration;

    @Override
    @Transactional
    public AuthenticationResponse register(RegisterRequest request) {
        String normalizedEmail = normalizeEmail(request.getEmail());
        if (userRepository.existsByEmailIgnoreCase(normalizedEmail)) {
            throw new BusinessException("Email already pending or in use", HttpStatus.CONFLICT);
        }

        Role userRole = roleRepository.findByName("ROLE_USER")
                .orElseGet(() -> roleRepository.save(Role.builder().name("ROLE_USER").build()));

        User user = User.builder()
                .firstName(request.getFirstName())
                .lastName(request.getLastName())
                .email(normalizedEmail)
                .password(passwordEncoder.encode(request.getPassword()))
                .roles(List.of(userRole))
                .isActive(true)
                .isEmailVerified(false)
                .build();

        User savedUser = userRepository.save(user);
        String otp = otpService.generateAndStoreOtp(savedUser.getEmail());
        emailMessagePublisher.publish(EmailMessage.builder()
                .to(savedUser.getEmail())
                .recipientName(savedUser.getFirstName())
                .otp(otp)
                .emailType(EmailMessage.EmailType.OTP)
                .build());

        return AuthenticationResponse.builder().status("PENDING_VERIFICATION").build();
    }

    @Override
    public AuthenticationResponse authenticate(LoginRequest request, SessionClientMetadata metadata) {
        String normalizedEmail = normalizeEmail(request.getEmail());
        abuseProtectionService.assertLoginAllowed(normalizedEmail, metadata.ipAddress());
        try {
            authenticationManager.authenticate(
                    new UsernamePasswordAuthenticationToken(normalizedEmail, request.getPassword()));
        } catch (BadCredentialsException ex) {
            abuseProtectionService.recordLoginFailure(normalizedEmail, metadata.ipAddress());
            securityEventLogger.warn("login_failure", java.util.Map.of(
                    "email", normalizedEmail,
                    "ip", metadata.ipAddress() == null ? "" : metadata.ipAddress(),
                    "deviceId", metadata.deviceId() == null ? "" : metadata.deviceId(),
                    "requestId", metadata.requestId() == null ? "" : metadata.requestId()
            ));
            throw ex;
        }

        User user = userRepository.findByEmailIgnoreCase(normalizedEmail)
                .orElseThrow(() -> new UnauthorizedException("Invalid email or password"));

        if (!user.isEmailVerified()) {
            abuseProtectionService.recordLoginFailure(normalizedEmail, metadata.ipAddress());
            throw new UnauthorizedException("Please verify your email before logging in");
        }
        abuseProtectionService.recordLoginSuccess(normalizedEmail, metadata.ipAddress());

        TokenService.RefreshIssueResult refreshIssue = tokenService.createRefreshToken(user, metadata);
        String accessToken = jwtProvider.generateAccessToken(user, new JwtProvider.AccessTokenContext(
                String.valueOf(refreshIssue.tokenEntity().getId()),
                String.valueOf(refreshIssue.tokenEntity().getTokenFamilyId()),
                metadata.deviceId()
        ));
        JwtProvider.AccessTokenParsed parsed = jwtProvider.parseAccessToken(accessToken);
        accessTokenRevocationService.linkAccessToken(
                parsed.jti(),
                parsed.expiresAt().toInstant(),
                parsed.sessionId(),
                parsed.familyId(),
                String.valueOf(user.getId()),
                metadata.requestId()
        );
        securityEventLogger.info("login_success", java.util.Map.of(
                "userId", String.valueOf(user.getId()),
                "email", user.getEmail(),
                "ip", metadata.ipAddress() == null ? "" : metadata.ipAddress(),
                "deviceId", metadata.deviceId() == null ? "" : metadata.deviceId(),
                "requestId", metadata.requestId() == null ? "" : metadata.requestId()
        ));

        return AuthenticationResponse.builder()
                .accessToken(accessToken)
                .refreshToken(refreshIssue.rawToken())
                .tokenType("Cookie")
                .expiresIn(jwtExpiration)
                .status("AUTHENTICATED")
                .build();
    }

    @Override
    public AuthenticationResponse refreshToken(String refreshTokenStr, SessionClientMetadata metadata) {
        TokenService.RefreshIssueResult rotated = tokenService.verifyAndRotateRefreshToken(refreshTokenStr, metadata);
        User user = rotated.tokenEntity().getUser();
        String accessToken = jwtProvider.generateAccessToken(user, new JwtProvider.AccessTokenContext(
                String.valueOf(rotated.tokenEntity().getId()),
                String.valueOf(rotated.tokenEntity().getTokenFamilyId()),
                metadata.deviceId()
        ));
        JwtProvider.AccessTokenParsed parsed = jwtProvider.parseAccessToken(accessToken);
        accessTokenRevocationService.linkAccessToken(
                parsed.jti(),
                parsed.expiresAt().toInstant(),
                parsed.sessionId(),
                parsed.familyId(),
                String.valueOf(user.getId()),
                metadata.requestId()
        );

        return AuthenticationResponse.builder()
                .accessToken(accessToken)
                .refreshToken(rotated.rawToken())
                .tokenType("Cookie")
                .expiresIn(jwtExpiration)
                .status("REFRESHED")
                .build();
    }

    @Override
    @Transactional
    public void verifyEmail(String token) {
        EmailVerificationToken verificationToken = tokenService.verifyEmailToken(token);
        User user = verificationToken.getUser();

        if (user.isEmailVerified()) {
            throw new BusinessException("Email already verified", HttpStatus.BAD_REQUEST);
        }

        user.setEmailVerified(true);
        userRepository.save(user);

        tokenService.markEmailTokenAsUsed(verificationToken);
    }

    @Override
    @Transactional
    public void resendVerificationEmail(String email) {
        User user = findUserByEmailOrThrow(email);

        if (user.isEmailVerified()) {
            throw new BusinessException("Email already verified", HttpStatus.BAD_REQUEST);
        }

        String token = tokenService.createEmailVerificationToken(user);
        emailMessagePublisher.publish(EmailMessage.builder()
                .to(user.getEmail())
                .recipientName(user.getFirstName())
                .token(token)
                .emailType(EmailMessage.EmailType.VERIFICATION)
                .build());
    }

    @Override
    @Transactional
    public void verifyOtp(VerifyOtpRequest request) {
        String normalizedEmail = normalizeEmail(request.getEmail());
        User user = findUserByEmailOrThrow(normalizedEmail);

        if (user.isEmailVerified()) {
            throw new BusinessException("Email already verified", HttpStatus.BAD_REQUEST);
        }

        otpService.validateAndConsumeOtp(normalizedEmail, request.getOtp());

        user.setEmailVerified(true);
        userRepository.save(user);
    }

    @Override
    @Transactional
    public void resendOtp(String email) {
        User user = findUserByEmailOrThrow(email);

        if (user.isEmailVerified()) {
            throw new BusinessException("Email already verified", HttpStatus.BAD_REQUEST);
        }

        String otp = otpService.generateAndStoreOtp(user.getEmail());
        emailMessagePublisher.publish(EmailMessage.builder()
                .to(user.getEmail())
                .recipientName(user.getFirstName())
                .otp(otp)
                .emailType(EmailMessage.EmailType.OTP)
                .build());
    }

    @Override
    @Transactional
    public void requestPasswordReset(String email) {
        User user = findUserByEmailOrThrow(email);

        String token = tokenService.createPasswordResetToken(user);
        emailMessagePublisher.publish(EmailMessage.builder()
                .to(user.getEmail())
                .recipientName(user.getFirstName())
                .token(token)
                .emailType(EmailMessage.EmailType.PASSWORD_RESET)
                .build());
    }

    @Override
    @Transactional
    public void resetPassword(ResetPasswordRequest request) {
        PasswordResetToken resetToken = tokenService.verifyPasswordResetToken(request.getToken());
        User user = resetToken.getUser();

        user.setPassword(passwordEncoder.encode(request.getNewPassword()));
        userRepository.save(user);

        tokenService.markPasswordResetTokenAsUsed(resetToken);
        tokenService.revokeRefreshToken(user, RefreshTokenRevocationReason.PASSWORD_RESET, null);
        accessTokenRevocationService.revokeUserAccessTokens(
                String.valueOf(user.getId()),
                RefreshTokenRevocationReason.PASSWORD_RESET.name(),
                null
        );
    }

    @Override
    @Transactional
    public void logout(String email, String refreshToken, SessionClientMetadata metadata) {
        User user = findUserByEmailOrThrow(email);
        if (refreshToken != null && !refreshToken.isBlank()) {
            tokenService.revokeRefreshTokenValue(refreshToken, RefreshTokenRevocationReason.LOGOUT, metadata);
            securityEventLogger.info("logout_success", java.util.Map.of(
                    "userId", String.valueOf(user.getId()),
                    "ip", metadata.ipAddress() == null ? "" : metadata.ipAddress(),
                    "deviceId", metadata.deviceId() == null ? "" : metadata.deviceId(),
                    "requestId", metadata.requestId() == null ? "" : metadata.requestId(),
                    "scope", "current_session"
            ));
            return;
        }
        tokenService.revokeRefreshToken(user, RefreshTokenRevocationReason.LOGOUT_ALL, metadata);
        securityEventLogger.info("logout_all_success", java.util.Map.of(
                "userId", String.valueOf(user.getId()),
                "ip", metadata.ipAddress() == null ? "" : metadata.ipAddress(),
                "deviceId", metadata.deviceId() == null ? "" : metadata.deviceId(),
                "requestId", metadata.requestId() == null ? "" : metadata.requestId(),
                "scope", "all_sessions"
        ));
    }

    private User findUserByEmailOrThrow(String email) {
        return userRepository.findByEmailIgnoreCase(normalizeEmail(email))
                .orElseThrow(() -> new BusinessException("User not found", HttpStatus.NOT_FOUND));
    }

    private String normalizeEmail(String email) {
        return email == null ? null : email.trim().toLowerCase(Locale.ROOT);
    }
}
