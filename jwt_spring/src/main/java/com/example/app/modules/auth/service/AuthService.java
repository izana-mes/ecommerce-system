package com.example.app.modules.auth.service;

import com.example.app.modules.auth.dto.response.AuthenticationResponse;
import com.example.app.modules.auth.dto.request.LoginRequest;
import com.example.app.modules.auth.dto.request.RegisterRequest;
import com.example.app.modules.auth.dto.request.ResetPasswordRequest;

/**
 * Interface defines all authentication-related business logic.
 */
public interface AuthService {

    AuthenticationResponse register(RegisterRequest request);

    AuthenticationResponse authenticate(LoginRequest request);

    AuthenticationResponse refreshToken(String refreshToken);

    void verifyEmail(String token);

    void resendVerificationEmail(String email);

    void requestPasswordReset(String email);

    void resetPassword(ResetPasswordRequest request);

    void logout(String email);
}
