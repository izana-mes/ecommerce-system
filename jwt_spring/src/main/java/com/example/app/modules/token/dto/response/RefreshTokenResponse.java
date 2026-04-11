package com.example.app.modules.token.dto.response;

import com.example.app.modules.token.entity.RefreshToken;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.UUID;

/**
 * DTO for refresh token information.
 * Used for session management - shows active sessions without exposing the actual token.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class RefreshTokenResponse {

    private UUID id;
    private UUID userId;
    private String userEmail;
    private boolean revoked;
    private LocalDateTime expiresAt;
    private LocalDateTime lastUsedAt;
    private LocalDateTime createdAt;

    public static RefreshTokenResponse fromEntity(RefreshToken token) {
        return RefreshTokenResponse.builder()
                .id(token.getId())
                .userId(token.getUser().getId())
                .userEmail(token.getUser().getEmail())
                .revoked(token.isRevoked())
                .expiresAt(token.getExpiresAt())
                .lastUsedAt(token.getLastUsedAt())
                .createdAt(token.getCreatedAt())
                .build();
    }
}
