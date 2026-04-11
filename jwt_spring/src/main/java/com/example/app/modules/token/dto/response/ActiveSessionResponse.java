package com.example.app.modules.token.dto.response;

import com.example.app.modules.token.entity.RefreshToken;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.UUID;

/**
 * DTO for user's active session information.
 * Shows sessions without exposing sensitive token data.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ActiveSessionResponse {

    private UUID sessionId;
    private LocalDateTime expiresAt;
    private LocalDateTime lastUsedAt;
    private LocalDateTime createdAt;
    private boolean current; // Indicates if this is the current session

    public static ActiveSessionResponse fromEntity(RefreshToken token, boolean isCurrent) {
        return ActiveSessionResponse.builder()
                .sessionId(token.getId())
                .expiresAt(token.getExpiresAt())
                .lastUsedAt(token.getLastUsedAt())
                .createdAt(token.getCreatedAt())
                .current(isCurrent)
                .build();
    }
}
