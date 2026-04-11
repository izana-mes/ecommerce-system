package com.example.app.modules.auth.service;

import com.example.app.common.exception.BusinessException;
import com.example.app.common.exception.UnauthorizedException;
import com.example.app.common.mail.EmailService;
import com.example.app.modules.auth.security.JwtProvider;
import com.example.app.modules.auth.dto.response.AuthenticationResponse;
import com.example.app.modules.auth.dto.request.LoginRequest;
import com.example.app.modules.auth.dto.request.RegisterRequest;
import com.example.app.modules.auth.dto.request.ResetPasswordRequest;
import com.example.app.modules.role.entity.Role;
import com.example.app.modules.role.repository.RoleRepository;
import com.example.app.modules.token.entity.EmailVerificationToken;
import com.example.app.modules.token.entity.PasswordResetToken;
import com.example.app.modules.token.entity.RefreshToken;
import com.example.app.modules.token.service.TokenService;
import com.example.app.modules.user.entity.User;
import com.example.app.modules.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
public class AuthServiceImpl implements AuthService {

    private final UserRepository userRepository;
    private final RoleRepository roleRepository;
    private final TokenService tokenService;
    private final EmailService emailService;
    private final JwtProvider jwtProvider;
    private final AuthenticationManager authenticationManager;
    private final PasswordEncoder passwordEncoder;

    @Value("${application.security.jwt.expiration}")
    private long jwtExpiration;

    @Override
    @Transactional
    public AuthenticationResponse register(RegisterRequest request) {
        if (userRepository.findByEmail(request.getEmail()).isPresent()) {
            throw new BusinessException("Email already pending or in use", HttpStatus.CONFLICT);
        }

        Role userRole = roleRepository.findByName("ROLE_USER")
                .orElseGet(() -> roleRepository.save(Role.builder().name("ROLE_USER").build()));

        User user = User.builder()
                .firstName(request.getFirstName())
                .lastName(request.getLastName())
                .email(request.getEmail())
                .password(passwordEncoder.encode(request.getPassword()))
                .roles(List.of(userRole))
                .isActive(true)
                .isEmailVerified(false)
                .build();

        User savedUser = userRepository.save(user);

        // Send verification email
        String token = tokenService.createEmailVerificationToken(savedUser);
        emailService.sendVerificationEmail(savedUser.getEmail(), savedUser.getFirstName(), token);

        // Generate preliminary tokens
        String accessToken = jwtProvider.generateAccessToken(savedUser);
        RefreshToken refreshToken = tokenService.createRefreshToken(savedUser);

        return AuthenticationResponse.builder()
                .accessToken(accessToken)
                .refreshToken(refreshToken.getRefreshTokenHash())
                .tokenType("Bearer")
                .expiresIn(jwtExpiration)
                .build();
    }

    @Override
    public AuthenticationResponse authenticate(LoginRequest request) {
        authenticationManager.authenticate(
                new UsernamePasswordAuthenticationToken(request.getEmail(), request.getPassword()));

        User user = userRepository.findByEmail(request.getEmail())
                .orElseThrow(() -> new UnauthorizedException("Invalid email or password"));

        if (!user.isEmailVerified()) {
            throw new UnauthorizedException("Please verify your email before logging in");
        }

        String accessToken = jwtProvider.generateAccessToken(user);
        RefreshToken refreshToken = tokenService.createRefreshToken(user);

        return AuthenticationResponse.builder()
                .accessToken(accessToken)
                .refreshToken(refreshToken.getRefreshTokenHash())
                .tokenType("Bearer")
                .expiresIn(jwtExpiration)
                .build();
    }

    @Override
    public AuthenticationResponse refreshToken(String refreshTokenStr) {
        RefreshToken refreshToken = tokenService.verifyRefreshToken(refreshTokenStr);
        User user = refreshToken.getUser();

        String accessToken = jwtProvider.generateAccessToken(user);

        return AuthenticationResponse.builder()
                .accessToken(accessToken)
                .refreshToken(refreshTokenStr)
                .tokenType("Bearer")
                .expiresIn(jwtExpiration)
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
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new BusinessException("User not found", HttpStatus.NOT_FOUND));

        if (user.isEmailVerified()) {
            throw new BusinessException("Email already verified", HttpStatus.BAD_REQUEST);
        }

        String token = tokenService.createEmailVerificationToken(user);
        emailService.sendVerificationEmail(user.getEmail(), user.getFirstName(), token);
    }

    @Override
    @Transactional
    public void requestPasswordReset(String email) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new BusinessException("User not found", HttpStatus.NOT_FOUND));

        String token = tokenService.createPasswordResetToken(user);
        emailService.sendPasswordResetEmail(user.getEmail(), user.getFirstName(), token);
    }

    @Override
    @Transactional
    public void resetPassword(ResetPasswordRequest request) {
        PasswordResetToken resetToken = tokenService.verifyPasswordResetToken(request.getToken());
        User user = resetToken.getUser();

        user.setPassword(passwordEncoder.encode(request.getNewPassword()));
        userRepository.save(user);

        tokenService.markPasswordResetTokenAsUsed(resetToken);
        tokenService.revokeRefreshToken(user);
    }

    @Override
    @Transactional
    public void logout(String email) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new BusinessException("User not found", HttpStatus.NOT_FOUND));
        tokenService.revokeRefreshToken(user);
    }
}
