package com.example.shop.modules.resale.repository;

import com.example.shop.modules.resale.entity.SellerResaleRequest;
import com.example.shop.modules.resale.entity.SellerResaleRequestStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface SellerResaleRequestRepository extends JpaRepository<SellerResaleRequest, UUID> {
    boolean existsBySellerIdAndSupplierOfferIdAndStatus(UUID sellerId, UUID supplierOfferId, SellerResaleRequestStatus status);
    List<SellerResaleRequest> findBySellerIdAndSupplierOfferIdOrderByCreatedAtDesc(UUID sellerId, UUID supplierOfferId);

    boolean existsBySellerIdAndSupplierProductIdAndStatus(UUID sellerId, String productId, SellerResaleRequestStatus status);

    Page<SellerResaleRequest> findBySellerIdOrderByCreatedAtDesc(UUID sellerId, Pageable pageable);

    Page<SellerResaleRequest> findBySellerIdAndStatusOrderByCreatedAtDesc(UUID sellerId, SellerResaleRequestStatus status, Pageable pageable);

    Page<SellerResaleRequest> findBySupplierUserIdOrderByCreatedAtDesc(UUID supplierUserId, Pageable pageable);

    Page<SellerResaleRequest> findBySupplierUserIdAndStatusOrderByCreatedAtDesc(UUID supplierUserId, SellerResaleRequestStatus status, Pageable pageable);

    @Query("SELECT r FROM SellerResaleRequest r WHERE r.supplierUserId = :supplierId AND r.supplierProductId = :productId ORDER BY r.createdAt DESC")
    List<SellerResaleRequest> findBySupplierAndProduct(@Param("supplierId") UUID supplierId, @Param("productId") String productId);

    @Query("SELECT r FROM SellerResaleRequest r ORDER BY r.createdAt DESC")
    Page<SellerResaleRequest> findAllOrderByCreatedAtDesc(Pageable pageable);

    @Query("SELECT r FROM SellerResaleRequest r WHERE r.status = :status ORDER BY r.createdAt DESC")
    Page<SellerResaleRequest> findAllByStatus(@Param("status") SellerResaleRequestStatus status, Pageable pageable);

    Optional<SellerResaleRequest> findBySellerIdAndSupplierProductIdAndStatus(UUID sellerId, String productId, SellerResaleRequestStatus status);

    List<SellerResaleRequest> findBySellerIdAndSupplierProductIdOrderByCreatedAtDesc(UUID sellerId, String productId);
}
