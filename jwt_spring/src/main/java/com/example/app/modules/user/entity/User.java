package com.example.app.modules.user.entity;

import com.example.app.modules.role.entity.Role;
import jakarta.persistence.*;
import lombok.*;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;

import java.security.Principal;
import java.time.LocalDateTime;
import java.util.Collection;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * User entity - maps to the users table.
 *
 * What this class does:
 * - Represents a user in the system with email, password, roles, and verification status
 * - Implements UserDetails for Spring Security (authentication)
 * - Implements Principal for accessing current user in controllers
 *
 * Why it exists:
 * - Core domain entity for authentication and authorization
 * - Single source of truth for user data
 *
 * Annotations:
 * - @Entity: JPA entity, maps to a database table
 * - @Table(name = "users"): Explicit table name
 * - @EntityListeners(AuditingEntityListener.class): Auto-fills createdAt, updatedAt
 *
 * Relationships:
 * - @ManyToMany with Role: A user can have multiple roles (USER, ADMIN, etc.)
 *
 * Important: Entity does NOT use DTOs - it's a pure persistence model.
 */
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "users")
@EntityListeners(AuditingEntityListener.class)
public class User implements UserDetails,Principal {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "users_id", updatable = false, nullable = false)
    private UUID id;

    @Column(name = "username", length = 100, unique = true)
    private String username;

    @Column(name = "email", unique = true, nullable = false)
    private String email;

    @Column(name = "password_hash", nullable = false)
    private String password;

    @Column(name = "first_name", length = 100)
    private String firstName;

    @Column(name = "last_name", length = 100)
    private String lastName;

    @Column(name = "phone", unique = true, length = 20)
    private String phone;

    @Column(name = "is_active")
    @Builder.Default
    private boolean isActive = true;

    @Column(name = "email_verified")
    @Builder.Default
    private boolean isEmailVerified = false;

    @CreatedDate
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @LastModifiedDate
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @ManyToMany(fetch = FetchType.EAGER)
    @JoinTable(name = "user_roles", joinColumns = @JoinColumn(name = "users_id", referencedColumnName = "users_id"), inverseJoinColumns = @JoinColumn(name = "roles_id", referencedColumnName = "roles_id"))
    private List<Role> roles;

    @Override
    public Collection<? extends GrantedAuthority> getAuthorities() {
        return this.roles
                .stream()
                .map(r -> new SimpleGrantedAuthority(r.getName()))
                .collect(Collectors.toList());
    }

    @Override
    public String getUsername() {
        return email;
    }

    @Override
    public String getPassword() {
        return password;
    }

    @Override
    public boolean isAccountNonExpired() {
        return true;
    }

    @Override
    public boolean isAccountNonLocked() {
        return isActive;
    }

    @Override
    public boolean isCredentialsNonExpired() {
        return true;
    }

    @Override
    public boolean isEnabled() {
        return isActive;
    }

    @Override
    public String getName() {
        return email;
    }
}