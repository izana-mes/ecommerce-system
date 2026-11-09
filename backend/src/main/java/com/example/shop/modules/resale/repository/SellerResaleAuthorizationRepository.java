package com.example.shop.modules.resale.repository;

import com.example.shop.modules.resale.entity.SellerResaleAuthorization;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface SellerResaleAuthorizationRepository extends JpaRepository<SellerResaleAuthorization, UUID> {
    @Query("select coalesce(sum(a.initialAllocationQuantity), 0) from SellerResaleAuthorization a where a.supplierUserId=:supplier and a.active=true and not exists (select l.id from SellerProductListing l where l.authorization.id=a.id)")
    Long sumUnlistedApprovedAllocations(@org.springframework.data.repository.query.Param("supplier") UUID supplierId);
    @Query("select coalesce(sum(a.initialAllocationQuantity), 0) from SellerResaleAuthorization a where a.supplierUserId=:supplier and a.supplierOffer.id=:offer and a.active=true and not exists (select l.id from SellerProductListing l where l.authorization.id=a.id)")
    Long sumUnlistedApprovedAllocationsForOffer(@org.springframework.data.repository.query.Param("supplier") UUID supplierId, @org.springframework.data.repository.query.Param("offer") UUID offerId);
    @Query("select coalesce(sum(a.initialAllocationQuantity), 0) from SellerResaleAuthorization a where a.supplierUserId=:supplier and a.supplierOffer.id=:offer and a.active=true and a.id != :excludedAuth and not exists (select l.id from SellerProductListing l where l.authorization.id=a.id)")
    Long sumUnlistedApprovedAllocationsForOfferExcluding(@org.springframework.data.repository.query.Param("supplier") UUID supplierId, @org.springframework.data.repository.query.Param("offer") UUID offerId, @org.springframework.data.repository.query.Param("excludedAuth") UUID excludedAuth);
    boolean existsBySellerIdAndSupplierOfferIdAndActiveTrue(UUID sellerId, UUID supplierOfferId);

    Optional<SellerResaleAuthorization> findByResaleRequestId(UUID requestId);

    Optional<SellerResaleAuthorization> findBySellerIdAndSupplierProductIdAndActiveTrue(UUID sellerId, String productId);

    boolean existsBySellerIdAndSupplierProductIdAndActiveTrue(UUID sellerId, String productId);

    Page<SellerResaleAuthorization> findBySellerIdOrderByGrantedAtDesc(UUID sellerId, Pageable pageable);

    Page<SellerResaleAuthorization> findBySellerIdAndActiveTrueOrderByGrantedAtDesc(UUID sellerId, Pageable pageable);

    Page<SellerResaleAuthorization> findBySupplierUserIdOrderByGrantedAtDesc(UUID supplierUserId, Pageable pageable);

    Page<SellerResaleAuthorization> findBySupplierUserIdAndActiveTrueOrderByGrantedAtDesc(UUID supplierUserId, Pageable pageable);

    @Query("SELECT a FROM SellerResaleAuthorization a ORDER BY a.grantedAt DESC")
    Page<SellerResaleAuthorization> findAllOrderByGrantedAtDesc(Pageable pageable);

    List<SellerResaleAuthorization> findBySellerIdAndSupplierProductIdOrderByGrantedAtDesc(UUID sellerId, String productId);
}
