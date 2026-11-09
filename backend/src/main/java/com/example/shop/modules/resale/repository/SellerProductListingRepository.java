package com.example.shop.modules.resale.repository;

import com.example.shop.modules.resale.entity.SellerProductListing;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface SellerProductListingRepository extends JpaRepository<SellerProductListing, UUID> {

    Optional<SellerProductListing> findBySellerIdAndSupplierProductId(UUID sellerId, String productId);

    boolean existsBySellerIdAndSupplierProductId(UUID sellerId, String productId);
    boolean existsBySellerIdAndSupplierOfferId(UUID sellerId, UUID supplierOfferId);

    List<SellerProductListing> findByActiveTrueOrderByCreatedAtDesc();

    Page<SellerProductListing> findBySellerIdOrderByCreatedAtDesc(UUID sellerId, Pageable pageable);

    Page<SellerProductListing> findBySellerIdAndActiveTrueOrderByCreatedAtDesc(UUID sellerId, Pageable pageable);

    List<SellerProductListing> findBySupplierProductIdAndActiveTrue(String productId);

    Page<SellerProductListing> findByAuthorizationIdOrderByCreatedAtDesc(UUID authorizationId, Pageable pageable);
}
