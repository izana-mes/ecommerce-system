package com.example.shop.modules.auth.service;

import com.example.shop.modules.auth.dto.request.LoginRequest;
import com.example.shop.modules.auth.dto.request.RegisterRequest;
import com.example.shop.modules.auth.dto.request.ResetPasswordRequest;
import com.example.shop.modules.auth.dto.request.VerifyOtpRequest;
import com.example.shop.modules.auth.dto.response.AuthenticationResponse;
import com.example.shop.modules.token.service.SessionClientMetadata;

public interface AuthService {

    AuthenticationResponse register(RegisterRequest request);

    AuthenticationResponse authenticate(LoginRequest request, SessionClientMetadata metadata);

    AuthenticationResponse refreshToken(String refreshToken, SessionClientMetadata metadata);

    void verifyEmail(String token);

    void resendVerificationEmail(String email);

    void verifyOtp(VerifyOtpRequest request);

    void resendOtp(String email);

    void requestPasswordReset(String email);

    void resetPassword(ResetPasswordRequest request);

    void logout(String email, String refreshToken, SessionClientMetadata metadata);
}
