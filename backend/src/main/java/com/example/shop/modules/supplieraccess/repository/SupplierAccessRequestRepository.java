package com.example.shop.modules.supplieraccess.repository;

import com.example.shop.modules.supplieraccess.entity.SupplierAccessRequest;
import com.example.shop.modules.supplieraccess.entity.SupplierAccessRequestStatus;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface SupplierAccessRequestRepository extends JpaRepository<SupplierAccessRequest, UUID> {

    List<SupplierAccessRequest> findAllByOrderByCreatedAtDesc();

    List<SupplierAccessRequest> findAllByStatusOrderByCreatedAtAsc(SupplierAccessRequestStatus status);

    Optional<SupplierAccessRequest> findFirstByRequestedByIdOrderByCreatedAtDesc(UUID requestedById);

    boolean existsByRequestedByIdAndStatus(UUID requestedById, SupplierAccessRequestStatus status);
}
