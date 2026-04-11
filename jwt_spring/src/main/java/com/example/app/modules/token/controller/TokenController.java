package com.example.app.modules.token.controller;

import com.example.app.common.response.ApiResponse;
import com.example.app.modules.token.dto.response.ActiveSessionResponse;
import com.example.app.modules.token.dto.response.RefreshTokenResponse;
import com.example.app.modules.token.service.TokenService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

/**
 * REST controller for session/token management.
 *
 * User endpoints:
 * - GET  /api/v1/sessions              - List current user's active sessions
 * - DELETE /api/v1/sessions/{id}       - Revoke a specific session (logout from device)
 * - DELETE /api/v1/sessions            - Revoke all sessions except current
 *
 * Admin endpoints:
 * - GET  /api/v1/admin/tokens          - List all active tokens
 * - DELETE /api/v1/admin/tokens/{id}   - Revoke specific token
 * - DELETE /api/v1/admin/tokens/user/{userId} - Revoke all tokens for user
 */
@RestController
@RequiredArgsConstructor
public class TokenController {

    private final TokenService tokenService;

    // ==================== USER SESSION ENDPOINTS ====================

    /**
     * Get current user's active sessions.
     */
    @GetMapping("/api/v1/sessions")
    public ResponseEntity<ApiResponse<List<ActiveSessionResponse>>> getMySessions(
            @AuthenticationPrincipal UserDetails userDetails,
            @RequestHeader(value = "X-Refresh-Token", required = false) String currentToken) {
        List<ActiveSessionResponse> sessions = tokenService.getUserSessions(
                userDetails.getUsername(), currentToken);
        return ResponseEntity.ok(ApiResponse.success(sessions));
    }

    /**
     * Revoke a specific session (logout from device).
     */
    @DeleteMapping("/api/v1/sessions/{sessionId}")
    public ResponseEntity<ApiResponse<Void>> revokeSession(
            @AuthenticationPrincipal UserDetails userDetails,
            @PathVariable UUID sessionId) {
        tokenService.revokeSession(userDetails.getUsername(), sessionId);
        return ResponseEntity.ok(ApiResponse.success(null, "Session revoked successfully"));
    }

    /**
     * Revoke all sessions except current (logout from all other devices).
     */
    @DeleteMapping("/api/v1/sessions")
    public ResponseEntity<ApiResponse<Void>> revokeAllOtherSessions(
            @AuthenticationPrincipal UserDetails userDetails,
            @RequestHeader(value = "X-Refresh-Token", required = false) String currentToken) {
        tokenService.revokeAllSessionsExceptCurrent(userDetails.getUsername(), currentToken);
        return ResponseEntity.ok(ApiResponse.success(null, "All other sessions revoked successfully"));
    }

    // ==================== ADMIN TOKEN ENDPOINTS ====================

    /**
     * Get all active tokens (admin only).
     */
    @GetMapping("/api/v1/admin/tokens")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<Page<RefreshTokenResponse>>> getAllActiveTokens(
            @PageableDefault(size = 20) Pageable pageable) {
        Page<RefreshTokenResponse> tokens = tokenService.getAllActiveTokens(pageable);
        return ResponseEntity.ok(ApiResponse.success(tokens));
    }

    /**
     * Revoke specific token (admin only).
     */
    @DeleteMapping("/api/v1/admin/tokens/{tokenId}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<Void>> revokeToken(@PathVariable UUID tokenId) {
        tokenService.revokeTokenById(tokenId);
        return ResponseEntity.ok(ApiResponse.success(null, "Token revoked successfully"));
    }

    /**
     * Revoke all tokens for a user (admin only).
     */
    @DeleteMapping("/api/v1/admin/tokens/user/{userId}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<Void>> revokeAllUserTokens(@PathVariable UUID userId) {
        tokenService.revokeAllUserSessions(userId);
        return ResponseEntity.ok(ApiResponse.success(null, "All user tokens revoked successfully"));
    }
}
