package com.example.shop.modules.resale.controller;

import com.example.shop.common.exception.BusinessException;
import com.example.shop.modules.resale.entity.SupplierProduct;
import com.example.shop.modules.resale.repository.SupplierProductRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.transaction.annotation.Transactional;
import java.util.UUID;
import java.util.List;

@RestController
@RequestMapping("/api/v1/admin/supplier-products")
@PreAuthorize("hasRole('ADMIN')")
@RequiredArgsConstructor
public class SupplierOfferApprovalController {
    private final SupplierProductRepository offers;
    @GetMapping("/pending")
    @Transactional(readOnly = true)
    public List<SupplierProductController.OfferView> pending() {
        return offers.findByApprovedFalseOrderByCreatedAtDesc().stream().map(SupplierProductController.OfferView::from).toList();
    }
    @PutMapping("/{offerId}/approval")
    @Transactional
    public SupplierProductController.OfferView approve(@PathVariable UUID offerId, @RequestParam boolean approved) {
        SupplierProduct offer = offers.findById(offerId).orElseThrow(() -> new BusinessException("Supplier offer not found", HttpStatus.NOT_FOUND));
        offer.setApproved(approved);
        return SupplierProductController.OfferView.from(offers.save(offer));
    }
}
