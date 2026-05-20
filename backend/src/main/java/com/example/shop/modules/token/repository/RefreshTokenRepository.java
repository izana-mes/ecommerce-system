package com.example.shop.modules.token.repository;

import com.example.shop.modules.token.entity.RefreshToken;
import com.example.shop.modules.token.entity.RefreshTokenRevocationReason;
import jakarta.persistence.LockModeType;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

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

    Optional<RefreshToken> findByTokenHash(String tokenHash);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select t from RefreshToken t where t.tokenHash = :tokenHash")
    Optional<RefreshToken> findByTokenHashForUpdate(@Param("tokenHash") String tokenHash);

    @Modifying
    void deleteByUser_Id(UUID userId);

    List<RefreshToken> findByUser_IdAndIsRevokedFalse(UUID userId);

    Page<RefreshToken> findByIsRevokedFalseAndExpiresAtAfter(LocalDateTime now, Pageable pageable);

    @Modifying
    @Query("update RefreshToken t set t.isRevoked=true, t.revokedAt=:revokedAt, t.revocationReason=:reason where t.id=:id and t.isRevoked=false")
    int revokeById(@Param("id") UUID id, @Param("revokedAt") LocalDateTime revokedAt, @Param("reason") RefreshTokenRevocationReason reason);

    @Modifying
    @Query("update RefreshToken t set t.isRevoked=true, t.revokedAt=:revokedAt, t.reuseDetectedAt=:reuseDetectedAt, t.revocationReason=:reason where t.tokenFamilyId=:familyId and t.isRevoked=false")
    int revokeTokenFamily(@Param("familyId") UUID familyId,
                          @Param("revokedAt") LocalDateTime revokedAt,
                          @Param("reuseDetectedAt") LocalDateTime reuseDetectedAt,
                          @Param("reason") RefreshTokenRevocationReason reason);

    @Query("select t from RefreshToken t where t.tokenFamilyId = :familyId")
    List<RefreshToken> findByTokenFamilyId(@Param("familyId") UUID familyId);
}
