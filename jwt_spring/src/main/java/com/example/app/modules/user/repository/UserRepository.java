package com.example.app.modules.user.repository;

import com.example.app.modules.user.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

/**
 * Spring Data JPA repository for User entity.
 *
 * What this class does:
 * - Provides CRUD and custom queries for User
 * - Methods follow Spring Data naming convention for auto-generated queries
 *
 * Why it exists:
 * - Repository layer: only database access, no business logic
 */
public interface UserRepository extends JpaRepository<User, UUID> {

    Optional<User> findByEmail(String email);

    Optional<User> findByUsername(String username);

    Optional<User> findByPhone(String phone);

    boolean existsByEmail(String email);

    boolean existsByUsername(String username);

    boolean existsByPhone(String phone);
}
