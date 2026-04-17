package com.example.shop.modules.user.service;

import com.example.shop.common.exception.BusinessException;
import com.example.shop.modules.role.entity.Role;
import com.example.shop.modules.role.repository.RoleRepository;
import com.example.shop.modules.user.dto.request.ChangePasswordRequest;
import com.example.shop.modules.user.dto.request.UpdateProfileRequest;
import com.example.shop.modules.user.dto.response.UserResponse;
import com.example.shop.modules.user.dto.response.UserSummaryResponse;
import com.example.shop.modules.user.entity.User;
import com.example.shop.modules.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.UUID;

/**
 * Service for user-related business logic.
 *
 * What this class does:
 * - Provides user CRUD operations
 * - Handles profile updates and password changes
 * - Converts entities to DTOs
 *
 * Why it exists:
 * - Keeps business logic separate from controller
 * - Single responsibility for user management
 */
@Service
@RequiredArgsConstructor
public class UserService {

    private final UserRepository userRepository;
    private final RoleRepository roleRepository;
    private final PasswordEncoder passwordEncoder;

    /**
     * Get user by ID.
     */
    @Transactional(readOnly = true)
    public Optional<UserResponse> findById(UUID id) {
        return userRepository.findById(id)
                .map(UserResponse::fromEntity);
    }

    /**
     * Get user by email.
     */
    @Transactional(readOnly = true)
    public Optional<UserResponse> findByEmail(String email) {
        return userRepository.findByEmail(email)
                .map(UserResponse::fromEntity);
    }

    /**
     * Get current user's profile.
     */
    @Transactional(readOnly = true)
    public UserResponse getCurrentUserProfile(String email) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new BusinessException("User not found", HttpStatus.NOT_FOUND));
        return UserResponse.fromEntity(user);
    }

    /**
     * Update current user's profile.
     */
    @Transactional
    public UserResponse updateProfile(String email, UpdateProfileRequest request) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new BusinessException("User not found", HttpStatus.NOT_FOUND));

        // Only update non-null fields
        if (request.getFirstName() != null) {
            user.setFirstName(request.getFirstName());
        }
        if (request.getLastName() != null) {
            user.setLastName(request.getLastName());
        }
        if (request.getPhone() != null) {
            // Check if phone is already taken by another user
            userRepository.findByPhone(request.getPhone())
                    .filter(u -> !u.getId().equals(user.getId()))
                    .ifPresent(u -> {
                        throw new BusinessException("Phone number already in use", HttpStatus.CONFLICT);
                    });
            user.setPhone(request.getPhone());
        }
        if (request.getUsername() != null) {
            // Check if username is already taken
            userRepository.findByUsername(request.getUsername())
                    .filter(u -> !u.getId().equals(user.getId()))
                    .ifPresent(u -> {
                        throw new BusinessException("Username already in use", HttpStatus.CONFLICT);
                    });
            user.setUsername(request.getUsername());
        }

        User savedUser = userRepository.save(user);
        return UserResponse.fromEntity(savedUser);
    }

    /**
     * Change current user's password.
     */
    @Transactional
    public void changePassword(String email, ChangePasswordRequest request) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new BusinessException("User not found", HttpStatus.NOT_FOUND));

        // Verify current password
        if (!passwordEncoder.matches(request.getCurrentPassword(), user.getPassword())) {
            throw new BusinessException("Current password is incorrect", HttpStatus.BAD_REQUEST);
        }

        // Verify new password confirmation
        if (!request.getNewPassword().equals(request.getConfirmPassword())) {
            throw new BusinessException("New password and confirmation do not match", HttpStatus.BAD_REQUEST);
        }

        // Check new password is different from current
        if (passwordEncoder.matches(request.getNewPassword(), user.getPassword())) {
            throw new BusinessException("New password must be different from current password", HttpStatus.BAD_REQUEST);
        }

        user.setPassword(passwordEncoder.encode(request.getNewPassword()));
        userRepository.save(user);
    }

    /**
     * Get all users with pagination (admin only).
     */
    @Transactional(readOnly = true)
    public Page<UserSummaryResponse> findAllUsers(Pageable pageable) {
        return userRepository.findAll(pageable)
                .map(UserSummaryResponse::fromEntity);
    }

    /**
     * Get user by ID (admin only).
     */
    @Transactional(readOnly = true)
    public UserResponse getUserById(UUID id) {
        User user = userRepository.findById(id)
                .orElseThrow(() -> new BusinessException("User not found", HttpStatus.NOT_FOUND));
        return UserResponse.fromEntity(user);
    }

    /**
     * Deactivate user (admin only).
     */
    @Transactional
    public void deactivateUser(UUID id) {
        User user = userRepository.findById(id)
                .orElseThrow(() -> new BusinessException("User not found", HttpStatus.NOT_FOUND));
        user.setActive(false);
        userRepository.save(user);
    }

    /**
     * Activate user (admin only).
     */
    @Transactional
    public void activateUser(UUID id) {
        User user = userRepository.findById(id)
                .orElseThrow(() -> new BusinessException("User not found", HttpStatus.NOT_FOUND));
        user.setActive(true);
        userRepository.save(user);
    }

    /**
     * Update user role (admin only).
     */
    @Transactional
    public UserResponse updateUserRole(UUID id, String requestedRole, String actorEmail) {
        User user = userRepository.findById(id)
                .orElseThrow(() -> new BusinessException("User not found", HttpStatus.NOT_FOUND));

        String normalizedRole = normalizeRequestedRole(requestedRole);

        if (actorEmail != null
                && actorEmail.equalsIgnoreCase(user.getEmail())
                && "ROLE_USER".equals(normalizedRole)) {
            throw new BusinessException("You cannot remove admin role from your own account", HttpStatus.BAD_REQUEST);
        }

        Role userRole = findOrCreateSystemRole("ROLE_USER");
        List<Role> nextRoles = new ArrayList<>();
        nextRoles.add(userRole);

        if ("ROLE_ADMIN".equals(normalizedRole)) {
            Role adminRole = findOrCreateSystemRole("ROLE_ADMIN");
            nextRoles.add(adminRole);
        }

        user.setRoles(nextRoles);
        User savedUser = userRepository.save(user);
        return UserResponse.fromEntity(savedUser);
    }

    private String normalizeRequestedRole(String requestedRole) {
        if (requestedRole == null) {
            throw new BusinessException("Role is required", HttpStatus.BAD_REQUEST);
        }

        String normalized = requestedRole.trim().toUpperCase(Locale.ROOT);
        if (normalized.isEmpty()) {
            throw new BusinessException("Role is required", HttpStatus.BAD_REQUEST);
        }

        if ("ADMIN".equals(normalized)) {
            normalized = "ROLE_ADMIN";
        } else if ("USER".equals(normalized)) {
            normalized = "ROLE_USER";
        }

        if (!"ROLE_USER".equals(normalized) && !"ROLE_ADMIN".equals(normalized)) {
            throw new BusinessException("Unsupported role. Allowed values: user, admin", HttpStatus.BAD_REQUEST);
        }
        return normalized;
    }

    private Role findOrCreateSystemRole(String roleName) {
        return roleRepository.findByName(roleName)
                .orElseGet(() -> roleRepository.save(Role.builder().name(roleName).build()));
    }
}
