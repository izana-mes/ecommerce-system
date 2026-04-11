package com.example.app.modules.role.repository;

import com.example.app.modules.role.entity.Role;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

/**
 * Spring Data JPA repository for Role entity.
 *
 * What this class does:
 * - CRUD and findByName for role lookup (e.g. ROLE_USER)
 *
 * Why it exists:
 * - Repository layer: database access only
 */
public interface RoleRepository extends JpaRepository<Role, UUID> {
    Optional<Role> findByName(String name);
}
