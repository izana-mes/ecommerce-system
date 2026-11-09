package com.example.shop.modules.resale.repository;

import com.example.shop.modules.resale.entity.SupplierProduct;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.data.jpa.repository.Lock;
import jakarta.persistence.LockModeType;
import java.util.*;

public interface SupplierProductRepository extends JpaRepository<SupplierProduct, UUID> {
    List<SupplierProduct> findBySupplierIdOrderByCreatedAtDesc(UUID supplierId);
    Page<SupplierProduct> findBySupplierId(UUID supplierId, Pageable pageable);
    long countByApprovedFalse();
    List<SupplierProduct> findByApprovedFalseOrderByCreatedAtDesc();
    Optional<SupplierProduct> findBySupplierIdAndProductProductID(UUID supplierId, String productId);
    @Query("select sp from SupplierProduct sp join fetch sp.product p join fetch sp.supplier s where sp.approved = true and sp.allowResale = true and sp.available = true and p.active = true and sp.stockQuantity - sp.reservedQuantity >= sp.minimumOrderQuantity")
    List<SupplierProduct> findEligibleOffers();
    @Query("select sp from SupplierProduct sp join fetch sp.product p join fetch sp.supplier s where sp.approved = true and sp.available = true and sp.directRetailEnabled = true and sp.directRetailPrice is not null and p.active = true and sp.stockQuantity - sp.reservedQuantity >= sp.minimumOrderQuantity")
    List<SupplierProduct> findEligibleDirectRetailOffers();
    @Query("select sp from SupplierProduct sp join fetch sp.product p join fetch sp.supplier s where sp.id = :id")
    Optional<SupplierProduct> findDetailedById(@Param("id") UUID id);
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select sp from SupplierProduct sp join fetch sp.product p join fetch sp.supplier s where sp.id = :id")
    Optional<SupplierProduct> findDetailedByIdForUpdate(@Param("id") UUID id);
}
