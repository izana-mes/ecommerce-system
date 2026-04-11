package com.example.app.modules.token.repository;

import com.example.app.modules.token.entity.RefreshToken;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * Repository for RefreshToken.
 *
 * Method naming follows Spring Data conventions for auto-generated queries.
 */
public interface RefreshTokenRepository extends JpaRepository<RefreshToken, UUID> {

    Optional<RefreshToken> findByRefreshTokenHash(String refreshTokenHash);

    @Modifying
    void deleteByUser_Id(UUID userId);

    List<RefreshToken> findByUser_IdAndIsRevokedFalse(UUID userId);

    Page<RefreshToken> findByIsRevokedFalseAndExpiresAtAfter(LocalDateTime now, Pageable pageable);
}
