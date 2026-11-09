package com.example.shop.modules.resale.repository;

import com.example.shop.modules.resale.entity.SupplierResaleCatalogFlag;
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
public interface SupplierResaleCatalogFlagRepository extends JpaRepository<SupplierResaleCatalogFlag, Long> {

    Optional<SupplierResaleCatalogFlag> findByProductId(String productId);

    List<SupplierResaleCatalogFlag> findBySupplierUserIdOrderByCreatedAtDesc(UUID supplierUserId);

    @Query("SELECT f FROM SupplierResaleCatalogFlag f WHERE f.resaleEnabled = true")
    Page<SupplierResaleCatalogFlag> findAllEnabled(Pageable pageable);

    List<SupplierResaleCatalogFlag> findByResaleEnabledTrueAndSupplierProductApprovedTrueOrderByUpdatedAtDesc();

    Page<SupplierResaleCatalogFlag> findByResaleEnabledTrueAndSupplierProductApprovedFalseOrderByCreatedAtDesc(Pageable pageable);

    @Query("SELECT f FROM SupplierResaleCatalogFlag f WHERE f.resaleEnabled = true AND f.supplierUserId = :supplierId")
    List<SupplierResaleCatalogFlag> findEnabledBySupplier(@Param("supplierId") UUID supplierId);
}
