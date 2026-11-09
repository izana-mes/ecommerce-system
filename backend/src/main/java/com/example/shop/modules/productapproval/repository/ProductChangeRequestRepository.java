package com.example.shop.modules.productapproval.repository;

import com.example.shop.modules.productapproval.entity.ProductChangeRequest;
import com.example.shop.modules.productapproval.entity.ProductChangeRequestStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import java.util.List;
import java.util.UUID;

public interface ProductChangeRequestRepository extends JpaRepository<ProductChangeRequest, UUID> {

    List<ProductChangeRequest> findAllByOrderByCreatedAtDesc();

    List<ProductChangeRequest> findAllByStatusOrderByCreatedAtAsc(ProductChangeRequestStatus status);
    Page<ProductChangeRequest> findByStatusOrderByCreatedAtAsc(ProductChangeRequestStatus status, Pageable pageable);
    long countByStatus(ProductChangeRequestStatus status);

    List<ProductChangeRequest> findAllByRequestedByIdOrderByCreatedAtDesc(UUID requestedById);

    boolean existsByTargetProductIdAndStatus(String targetProductId, ProductChangeRequestStatus status);
}
