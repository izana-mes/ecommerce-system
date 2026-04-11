package com.example.app.modules.role.controller;

import com.example.app.common.response.ApiResponse;
import com.example.app.modules.role.dto.request.AssignRoleRequest;
import com.example.app.modules.role.dto.request.CreateRoleRequest;
import com.example.app.modules.role.dto.response.RoleResponse;
import com.example.app.modules.role.service.RoleService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

/**
 * REST controller for role management (admin only).
 *
 * Endpoints:
 * - GET    /api/v1/roles           - List all roles
 * - GET    /api/v1/roles/{id}      - Get role by ID
 * - POST   /api/v1/roles           - Create new role
 * - DELETE /api/v1/roles/{id}      - Delete role
 * - POST   /api/v1/roles/assign    - Assign role to user
 * - POST   /api/v1/roles/remove    - Remove role from user
 * - GET    /api/v1/roles/user/{userId} - Get user's roles
 *
 * All endpoints require ROLE_ADMIN.
 */
@RestController
@RequestMapping("/api/v1/roles")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
public class RoleController {

    private final RoleService roleService;

    /**
     * Get all roles.
     */
    @GetMapping
    public ResponseEntity<ApiResponse<List<RoleResponse>>> getAllRoles() {
        List<RoleResponse> roles = roleService.findAllRoles();
        return ResponseEntity.ok(ApiResponse.success(roles));
    }

    /**
     * Get role by ID.
     */
    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<RoleResponse>> getRoleById(@PathVariable UUID id) {
        RoleResponse role = roleService.findById(id);
        return ResponseEntity.ok(ApiResponse.success(role));
    }

    /**
     * Create a new role.
     */
    @PostMapping
    public ResponseEntity<ApiResponse<RoleResponse>> createRole(
            @Valid @RequestBody CreateRoleRequest request) {
        RoleResponse role = roleService.createRole(request);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success(role, "Role created successfully"));
    }

    /**
     * Delete a role.
     */
    @DeleteMapping("/{id}")
    public ResponseEntity<ApiResponse<Void>> deleteRole(@PathVariable UUID id) {
        roleService.deleteRole(id);
        return ResponseEntity.ok(ApiResponse.success(null, "Role deleted successfully"));
    }

    /**
     * Assign role to user.
     */
    @PostMapping("/assign")
    public ResponseEntity<ApiResponse<Void>> assignRole(
            @Valid @RequestBody AssignRoleRequest request) {
        roleService.assignRoleToUser(request.getUserId(), request.getRoleId());
        return ResponseEntity.ok(ApiResponse.success(null, "Role assigned successfully"));
    }

    /**
     * Remove role from user.
     */
    @PostMapping("/remove")
    public ResponseEntity<ApiResponse<Void>> removeRole(
            @Valid @RequestBody AssignRoleRequest request) {
        roleService.removeRoleFromUser(request.getUserId(), request.getRoleId());
        return ResponseEntity.ok(ApiResponse.success(null, "Role removed successfully"));
    }

    /**
     * Get roles for a specific user.
     */
    @GetMapping("/user/{userId}")
    public ResponseEntity<ApiResponse<List<RoleResponse>>> getUserRoles(@PathVariable UUID userId) {
        List<RoleResponse> roles = roleService.getUserRoles(userId);
        return ResponseEntity.ok(ApiResponse.success(roles));
    }
}
