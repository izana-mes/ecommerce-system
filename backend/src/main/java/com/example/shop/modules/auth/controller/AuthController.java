package com.example.shop.modules.auth.controller;

import com.example.shop.common.response.ApiResponse;
import com.example.shop.modules.auth.dto.request.*;
import com.example.shop.modules.auth.dto.response.AuthenticationResponse;
import com.example.shop.modules.auth.security.AccessTokenCookieWriter;
import com.example.shop.modules.auth.service.AuthService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

/**
 * REST controller for authentication operations.
 *
 * Public endpoints (no auth required):
 * - POST /api/v1/auth/register          - Register new user
 * - POST /api/v1/auth/authenticate      - Login
 * - POST /api/v1/auth/refresh           - Refresh access token
 * - GET  /api/v1/auth/verify-email      - Verify email with token
 * - POST /api/v1/auth/resend-verification - Resend verification email
 * - POST /api/v1/auth/forgot-password   - Request password reset
 * - POST /api/v1/auth/reset-password    - Reset password with token
 *
 * Protected endpoints (auth required):
 * - POST /api/v1/auth/logout            - Logout (revoke refresh token)
 */
@RestController
@RequestMapping("/api/v1/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthService service;
    private final AccessTokenCookieWriter accessTokenCookieWriter;

    @PostMapping("/register")
    public ResponseEntity<ApiResponse<AuthenticationResponse>> register(
            @Valid @RequestBody RegisterRequest request) {
        return ResponseEntity.ok(ApiResponse.success(service.register(request)));
    }

    @PostMapping("/authenticate")
    public ResponseEntity<ApiResponse<AuthenticationResponse>> authenticate(
            @Valid @RequestBody LoginRequest request,
            HttpServletRequest httpRequest,
            HttpServletResponse httpResponse) {
        AuthenticationResponse body = service.authenticate(request);
        accessTokenCookieWriter.addCookie(httpRequest, httpResponse, body.getAccessToken());
        return ResponseEntity.ok(ApiResponse.success(body));
    }

    @PostMapping("/refresh")
    public ResponseEntity<ApiResponse<AuthenticationResponse>> refreshToken(
            @Valid @RequestBody RefreshTokenRequest request,
            HttpServletRequest httpRequest,
            HttpServletResponse httpResponse) {
        AuthenticationResponse body = service.refreshToken(request.getRefreshToken());
        accessTokenCookieWriter.addCookie(httpRequest, httpResponse, body.getAccessToken());
        return ResponseEntity.ok(ApiResponse.success(body));
    }

    @GetMapping("/verify-email")
    public ResponseEntity<ApiResponse<Void>> verifyEmail(
            @RequestParam("token") String token) {
        service.verifyEmail(token);
        return ResponseEntity.ok(ApiResponse.success(null, "Email verified successfully"));
    }

    @PostMapping("/resend-verification")
    public ResponseEntity<ApiResponse<Void>> resendVerification(
            @Valid @RequestBody ResendVerificationRequest request) {
        service.resendVerificationEmail(request.getEmail());
        return ResponseEntity.ok(ApiResponse.success(null, "Verification email sent"));
    }

    @PostMapping("/verify-otp")
    public ResponseEntity<ApiResponse<Void>> verifyOtp(
            @Valid @RequestBody VerifyOtpRequest request) {
        service.verifyOtp(request);
        return ResponseEntity.ok(ApiResponse.success(null, "OTP verified successfully"));
    }

    @PostMapping("/resend-otp")
    public ResponseEntity<ApiResponse<Void>> resendOtp(
            @Valid @RequestBody ResendVerificationRequest request) {
        service.resendOtp(request.getEmail());
        return ResponseEntity.ok(ApiResponse.success(null, "OTP sent"));
    }

    @PostMapping("/forgot-password")
    public ResponseEntity<ApiResponse<Void>> forgotPassword(
            @Valid @RequestBody ForgotPasswordRequest request) {
        service.requestPasswordReset(request.getEmail());
        return ResponseEntity.ok(ApiResponse.success(null, "Password reset email sent"));
    }

    @PostMapping("/reset-password")
    public ResponseEntity<ApiResponse<Void>> resetPassword(
            @Valid @RequestBody ResetPasswordRequest request) {
        service.resetPassword(request);
        return ResponseEntity.ok(ApiResponse.success(null, "Password reset successfully"));
    }

    /**
     * Logout - revoke the current refresh token.
     */
    @PostMapping("/logout")
    public ResponseEntity<ApiResponse<Void>> logout(
            @AuthenticationPrincipal UserDetails userDetails) {
        if (userDetails != null && userDetails.getUsername() != null) {
            service.logout(userDetails.getUsername());
        }
        return ResponseEntity.ok(ApiResponse.success(null, "Logged out successfully"));
    }
}
