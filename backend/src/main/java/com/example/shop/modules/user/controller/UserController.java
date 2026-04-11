package com.example.shop.modules.user.controller;

import com.example.shop.common.audit.AdminAuditLogger;
import com.example.shop.common.response.ApiResponse;
import com.example.shop.modules.user.dto.request.ChangePasswordRequest;
import com.example.shop.modules.user.dto.request.UpdateProfileRequest;
import com.example.shop.modules.user.dto.response.UserResponse;
import com.example.shop.modules.user.dto.response.UserSummaryResponse;
import com.example.shop.modules.user.service.UserService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.UUID;

/**
 * REST controller for user management.
 *
 * Endpoints:
 * - GET  /api/v1/users/me           - Get current user profile
 * - PUT  /api/v1/users/me           - Update current user profile
 * - POST /api/v1/users/me/password  - Change password
 * - GET  /api/v1/users              - List all users (admin)
 * - GET  /api/v1/users/{id}         - Get user by ID (admin)
 * - POST /api/v1/users/{id}/deactivate - Deactivate user (admin)
 * - POST /api/v1/users/{id}/activate   - Activate user (admin)
 *
 * All endpoints require authentication.
 * Admin endpoints require ROLE_ADMIN.
 */
@RestController
@RequestMapping("/api/v1/users")
@RequiredArgsConstructor
public class UserController {

    private final UserService userService;
    private final AdminAuditLogger adminAuditLogger;

    // ==================== CURRENT USER ENDPOINTS ====================

    /**
     * Get current authenticated user's profile.
     */
    @GetMapping("/me")
    public ResponseEntity<ApiResponse<UserResponse>> getCurrentUser(
            @AuthenticationPrincipal UserDetails userDetails) {
        UserResponse user = userService.getCurrentUserProfile(userDetails.getUsername());
        return ResponseEntity.ok(ApiResponse.success(user));
    }

    /**
     * Update current user's profile.
     */
    @PutMapping("/me")
    public ResponseEntity<ApiResponse<UserResponse>> updateProfile(
            @AuthenticationPrincipal UserDetails userDetails,
            @Valid @RequestBody UpdateProfileRequest request) {
        UserResponse user = userService.updateProfile(userDetails.getUsername(), request);
        return ResponseEntity.ok(ApiResponse.success(user, "Profile updated successfully"));
    }

    /**
     * Change current user's password.
     */
    @PostMapping("/me/password")
    public ResponseEntity<ApiResponse<Void>> changePassword(
            @AuthenticationPrincipal UserDetails userDetails,
            @Valid @RequestBody ChangePasswordRequest request) {
        userService.changePassword(userDetails.getUsername(), request);
        return ResponseEntity.ok(ApiResponse.success(null, "Password changed successfully"));
    }

    // ==================== ADMIN ENDPOINTS ====================

    /**
     * Get all users with pagination (admin only).
     */
    @GetMapping
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<Page<UserSummaryResponse>>> getAllUsers(
            @AuthenticationPrincipal UserDetails actor,
            @PageableDefault(size = 20) Pageable pageable) {
        Page<UserSummaryResponse> users = userService.findAllUsers(pageable);
        adminAuditLogger.log(
                "USER_LIST",
                actorEmail(actor),
                Map.of("page", pageable.getPageNumber(), "size", pageable.getPageSize(), "resultCount", users.getNumberOfElements())
        );
        return ResponseEntity.ok(ApiResponse.success(users));
    }

    /**
     * Get user by ID (admin only).
     */
    @GetMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<UserResponse>> getUserById(
            @PathVariable("id") UUID id,
            @AuthenticationPrincipal UserDetails actor
    ) {
        UserResponse user = userService.getUserById(id);
        adminAuditLogger.log("USER_READ", actorEmail(actor), Map.of("targetUserId", id.toString()));
        return ResponseEntity.ok(ApiResponse.success(user));
    }

    /**
     * Deactivate a user (admin only).
     */
    @PostMapping("/{id}/deactivate")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<Void>> deactivateUser(
            @PathVariable("id") UUID id,
            @AuthenticationPrincipal UserDetails actor
    ) {
        userService.deactivateUser(id);
        adminAuditLogger.log("USER_DEACTIVATE", actorEmail(actor), Map.of("targetUserId", id.toString()));
        return ResponseEntity.ok(ApiResponse.success(null, "User deactivated successfully"));
    }

    /**
     * Activate a user (admin only).
     */
    @PostMapping("/{id}/activate")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<Void>> activateUser(
            @PathVariable("id") UUID id,
            @AuthenticationPrincipal UserDetails actor
    ) {
        userService.activateUser(id);
        adminAuditLogger.log("USER_ACTIVATE", actorEmail(actor), Map.of("targetUserId", id.toString()));
        return ResponseEntity.ok(ApiResponse.success(null, "User activated successfully"));
    }

    private String actorEmail(UserDetails actor) {
        return actor == null ? "unknown" : actor.getUsername();
    }
}
