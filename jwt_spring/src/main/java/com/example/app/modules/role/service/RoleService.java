package com.example.app.modules.role.service;

import com.example.app.common.exception.BusinessException;
import com.example.app.modules.role.dto.request.CreateRoleRequest;
import com.example.app.modules.role.dto.response.RoleResponse;
import com.example.app.modules.role.entity.Role;
import com.example.app.modules.role.repository.RoleRepository;
import com.example.app.modules.user.entity.User;
import com.example.app.modules.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * Service for role management (admin only).
 *
 * What this class does:
 * - CRUD operations for roles
 * - Assign/remove roles from users
 *
 * Why it exists:
 * - Centralized role management logic
 * - Supports role-based access control (RBAC)
 */
@Service
@RequiredArgsConstructor
public class RoleService {

    private final RoleRepository roleRepository;
    private final UserRepository userRepository;

    /**
     * Get all roles.
     */
    @Transactional(readOnly = true)
    public List<RoleResponse> findAllRoles() {
        return roleRepository.findAll().stream()
                .map(RoleResponse::fromEntity)
                .collect(Collectors.toList());
    }

    /**
     * Get role by ID.
     */
    @Transactional(readOnly = true)
    public RoleResponse findById(UUID id) {
        Role role = roleRepository.findById(id)
                .orElseThrow(() -> new BusinessException("Role not found", HttpStatus.NOT_FOUND));
        return RoleResponse.fromEntity(role);
    }

    /**
     * Get role by name.
     */
    @Transactional(readOnly = true)
    public RoleResponse findByName(String name) {
        Role role = roleRepository.findByName(name)
                .orElseThrow(() -> new BusinessException("Role not found", HttpStatus.NOT_FOUND));
        return RoleResponse.fromEntity(role);
    }

    /**
     * Create a new role.
     */
    @Transactional
    public RoleResponse createRole(CreateRoleRequest request) {
        if (roleRepository.findByName(request.getName()).isPresent()) {
            throw new BusinessException("Role already exists", HttpStatus.CONFLICT);
        }

        Role role = Role.builder()
                .name(request.getName())
                .build();

        Role savedRole = roleRepository.save(role);
        return RoleResponse.fromEntity(savedRole);
    }

    /**
     * Delete a role.
     */
    @Transactional
    public void deleteRole(UUID id) {
        Role role = roleRepository.findById(id)
                .orElseThrow(() -> new BusinessException("Role not found", HttpStatus.NOT_FOUND));

        // Prevent deletion of system roles
        if ("ROLE_USER".equals(role.getName()) || "ROLE_ADMIN".equals(role.getName())) {
            throw new BusinessException("Cannot delete system roles", HttpStatus.BAD_REQUEST);
        }

        roleRepository.delete(role);
    }

    /**
     * Assign role to user.
     */
    @Transactional
    public void assignRoleToUser(UUID userId, UUID roleId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new BusinessException("User not found", HttpStatus.NOT_FOUND));

        Role role = roleRepository.findById(roleId)
                .orElseThrow(() -> new BusinessException("Role not found", HttpStatus.NOT_FOUND));

        // Check if user already has this role
        if (user.getRoles().stream().anyMatch(r -> r.getId().equals(roleId))) {
            throw new BusinessException("User already has this role", HttpStatus.CONFLICT);
        }

        List<Role> roles = new ArrayList<>(user.getRoles());
        roles.add(role);
        user.setRoles(roles);
        userRepository.save(user);
    }

    /**
     * Remove role from user.
     */
    @Transactional
    public void removeRoleFromUser(UUID userId, UUID roleId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new BusinessException("User not found", HttpStatus.NOT_FOUND));

        Role role = roleRepository.findById(roleId)
                .orElseThrow(() -> new BusinessException("Role not found", HttpStatus.NOT_FOUND));

        // Prevent removing the last role
        if (user.getRoles().size() <= 1) {
            throw new BusinessException("User must have at least one role", HttpStatus.BAD_REQUEST);
        }

        // Prevent removing ROLE_USER from regular users
        if ("ROLE_USER".equals(role.getName()) && user.getRoles().size() == 1) {
            throw new BusinessException("Cannot remove the only role from user", HttpStatus.BAD_REQUEST);
        }

        List<Role> roles = new ArrayList<>(user.getRoles());
        roles.removeIf(r -> r.getId().equals(roleId));
        user.setRoles(roles);
        userRepository.save(user);
    }

    /**
     * Get roles for a specific user.
     */
    @Transactional(readOnly = true)
    public List<RoleResponse> getUserRoles(UUID userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new BusinessException("User not found", HttpStatus.NOT_FOUND));

        return user.getRoles().stream()
                .map(RoleResponse::fromEntity)
                .collect(Collectors.toList());
    }
}
