package com.example.shop.modules.product.repository;

import com.example.shop.modules.product.entity.Product;
import org.springframework.data.jpa.repository.JpaRepository;

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
}
