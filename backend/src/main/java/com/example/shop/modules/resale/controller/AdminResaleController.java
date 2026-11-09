package com.example.shop.modules.resale.controller;

import com.example.shop.modules.resale.dto.ResaleAuthorizationDto;
import com.example.shop.modules.resale.dto.ResaleRequestResponseDto;
import com.example.shop.modules.resale.dto.SellerProfileDto;
import com.example.shop.modules.resale.dto.SupplierPublicProfileDto;
import com.example.shop.modules.resale.dto.SupplierResaleCatalogFlagDto;
import com.example.shop.modules.resale.service.ResaleService;
import com.example.shop.modules.user.entity.User;
import com.example.shop.modules.user.entity.SupplierOperatingMode;
import com.example.shop.modules.user.repository.UserRepository;
import com.example.shop.common.exception.BusinessException;
import org.springframework.http.HttpStatus;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1/admin/resale")
@PreAuthorize("hasRole('ADMIN')")
@RequiredArgsConstructor
public class AdminResaleController {

    private final ResaleService resaleService;
    private final UserRepository userRepository;

    public record OperatingModeRequest(SupplierOperatingMode operatingMode) { }

    @PutMapping("/suppliers/{supplierId}/operating-mode")
    public ResponseEntity<OperatingModeRequest> setSupplierOperatingMode(@PathVariable UUID supplierId,
                                                                          @RequestBody OperatingModeRequest body) {
        User supplier = userRepository.findById(supplierId)
                .orElseThrow(() -> new BusinessException("Supplier not found", HttpStatus.NOT_FOUND));
        boolean isSupplier = supplier.getRoles() != null && supplier.getRoles().stream().anyMatch(r -> "ROLE_SUPPLIER".equalsIgnoreCase(r.getName()) || "SUPPLIER".equalsIgnoreCase(r.getName()));
        if (!isSupplier) throw new BusinessException("User is not a Supplier", HttpStatus.BAD_REQUEST);
        if (body == null || body.operatingMode() == null) throw new BusinessException("operatingMode is required", HttpStatus.BAD_REQUEST);
        supplier.setSupplierOperatingMode(body.operatingMode());
        userRepository.save(supplier);
        return ResponseEntity.ok(body);
    }

    @PostMapping("/catalog-products/{productId}/approve")
    public ResponseEntity<Void> approveSupplierCatalogProduct(@PathVariable String productId) {
        resaleService.approveSupplierCatalogProduct(productId);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/catalog-products/pending")
    public ResponseEntity<Page<SupplierResaleCatalogFlagDto>> pendingSupplierProducts(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return ResponseEntity.ok(resaleService.adminListPendingSupplierProducts(
                PageRequest.of(Math.max(0, page), Math.max(1, Math.min(size, 100)))));
    }

    @GetMapping("/requests")
    public ResponseEntity<Page<ResaleRequestResponseDto>> listAllRequests(
            @RequestParam(required = false) String status,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return ResponseEntity.ok(resaleService.adminListAllRequests(status,
                PageRequest.of(page, Math.min(size, 100))));
    }

    @PostMapping("/requests/{requestId}/approve")
    public ResponseEntity<ResaleRequestResponseDto> approveSellerRequest(@PathVariable UUID requestId,
            @RequestBody(required = false) com.example.shop.modules.resale.dto.ReviewResaleRequestDto body,
            @AuthenticationPrincipal User admin) {
        return ResponseEntity.ok(resaleService.acceptRequest(requestId, body == null ? null : body.getNote(), admin));
    }

    @PostMapping("/requests/{requestId}/reject")
    public ResponseEntity<ResaleRequestResponseDto> rejectSellerRequest(@PathVariable UUID requestId,
            @RequestBody com.example.shop.modules.resale.dto.ReviewResaleRequestDto body,
            @AuthenticationPrincipal User admin) {
        return ResponseEntity.ok(resaleService.rejectRequest(requestId, body == null ? null : body.getNote(), admin));
    }

    @GetMapping("/requests/{requestId}")
    public ResponseEntity<ResaleRequestResponseDto> getRequest(
            @PathVariable UUID requestId,
            @AuthenticationPrincipal User actor) {
        return ResponseEntity.ok(resaleService.getRequest(requestId, actor));
    }

    @GetMapping("/authorizations")
    public ResponseEntity<Page<ResaleAuthorizationDto>> listAllAuthorizations(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return ResponseEntity.ok(resaleService.adminListAllAuthorizations(
                PageRequest.of(page, Math.min(size, 100))));
    }

    @GetMapping("/suppliers/{supplierId}/profile")
    public ResponseEntity<SupplierPublicProfileDto> supplierProfile(@PathVariable UUID supplierId) {
        return ResponseEntity.ok(resaleService.getSupplierPublicProfile(supplierId));
    }

    @GetMapping("/sellers/{sellerId}/profile")
    public ResponseEntity<SellerProfileDto> sellerProfile(
            @PathVariable UUID sellerId,
            @AuthenticationPrincipal User actor) {
        return ResponseEntity.ok(resaleService.getSellerProfileForSupplier(sellerId, actor));
    }
}
