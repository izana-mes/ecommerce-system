package com.example.app.modules.role.entity;

import com.example.app.modules.user.entity.User;
import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import lombok.*;

import java.util.List;
import java.util.UUID;

/**
 * Role entity - maps to the roles table.
 *
 * What this class does:
 * - Represents a role (e.g. ROLE_USER, ROLE_ADMIN)
 * - Used for authorization via Spring Security's GrantedAuthority
 *
 * Why it exists:
 * - Enables role-based access control (RBAC)
 * - Many-to-many with User: flexible permission model
 *
 * Annotations:
 * - @Entity: JPA entity
 * - @ManyToMany(mappedBy = "roles"): Inverse side of User.roles relationship
 * - @JsonIgnore on users: Prevents circular serialization in REST responses
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "roles")
public class Role {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "roles_id", updatable = false, nullable = false)
    private UUID id;

    @Column(name = "roles_name", length = 50, unique = true, nullable = false)
    private String name;

    @ManyToMany(mappedBy = "roles")
    @JsonIgnore
    private List<User> users;
}
