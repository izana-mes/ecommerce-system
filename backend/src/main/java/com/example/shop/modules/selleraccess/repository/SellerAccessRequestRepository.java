package com.example.shop.modules.selleraccess.repository;

import com.example.shop.modules.selleraccess.entity.SellerAccessRequest;
import com.example.shop.modules.selleraccess.entity.SellerAccessRequestStatus;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface SellerAccessRequestRepository extends JpaRepository<SellerAccessRequest, UUID> {

    List<SellerAccessRequest> findAllByOrderByCreatedAtDesc();

    List<SellerAccessRequest> findAllByStatusOrderByCreatedAtDesc(SellerAccessRequestStatus status);

    Optional<SellerAccessRequest> findFirstByRequestedByIdOrderByCreatedAtDesc(UUID requestedById);

    boolean existsByRequestedByIdAndStatus(UUID requestedById, SellerAccessRequestStatus status);
}

