package com.example.shop.modules.product.repository;

import com.example.shop.modules.product.entity.Product;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface ProductRepository extends JpaRepository<Product, Long> {

    Optional<Product> findByProductID(String productID);

    List<Product> findByProductIDIn(List<String> productIds);

    List<Product> findAllByOrderByIdAsc();

    List<Product> findBySupplierUserIdOrderByIdAsc(UUID supplierUserId);

    List<Product> findByProductNameContainingIgnoreCaseOrProductIDContainingIgnoreCaseOrderByIdAsc(
            String productName,
            String productID
    );

    /** All products owned by the given seller, ordered by id asc. */
    List<Product> findBySellerUserIdOrderByIdAsc(UUID sellerUserId);

    /**
     * Active products whose stock is at or below {@code threshold},
     * ordered by stock quantity ascending (most urgent first).
     * Pushes the filter to the DB — no in-memory scan.
     */
    @Query("""
            SELECT p FROM Product p
            WHERE p.sellerUserId = :sellerUserId
              AND p.active = true
              AND COALESCE(p.stockQuantity, 0) <= :threshold
            ORDER BY p.stockQuantity ASC, p.id ASC
            """)
    List<Product> findLowStockBySeller(
            @Param("sellerUserId") UUID sellerUserId,
            @Param("threshold") int threshold
    );
}
