package com.example.shop.modules.resale.controller;

import com.example.shop.modules.resale.dto.*;
import com.example.shop.modules.resale.service.ResaleService;
import com.example.shop.modules.user.entity.User;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1/seller/resale")
@PreAuthorize("hasRole('SELLER')")
@RequiredArgsConstructor
public class SellerResaleController {

    private final ResaleService resaleService;

    // --- Browse Supplier Catalog ---

    @GetMapping("/supplier-catalog")
    public ResponseEntity<Page<SupplierCatalogProductDto>> browseSupplierCatalog(
            @RequestParam(required = false) UUID supplierUserId,
            @RequestParam(required = false) String category,
            @RequestParam(required = false) String brand,
            @RequestParam(required = false) String sku,
            @RequestParam(required = false) String q,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(required = false) String sort,
            @AuthenticationPrincipal User actor) {
        String sortField = switch (sort == null ? "name" : sort.toLowerCase(java.util.Locale.ROOT)) {
            case "price" -> "productPrice";
            case "stock" -> "stockQuantity";
            default -> "productName";
        };
        return ResponseEntity.ok(resaleService.browseSupplierCatalog(supplierUserId, category, q, brand, sku, actor,
                PageRequest.of(Math.max(page, 0), Math.max(1, Math.min(size, 100)), org.springframework.data.domain.Sort.by(sortField))));
    }

    // --- Resale Requests ---

    @PostMapping("/requests")
    public ResponseEntity<ResaleRequestResponseDto> submitRequest(
            @RequestBody @Valid SubmitResaleRequestDto dto,
            @AuthenticationPrincipal User actor) {
        return ResponseEntity.ok(resaleService.submitRequest(dto, actor));
    }

    @GetMapping("/requests")
    public ResponseEntity<Page<ResaleRequestResponseDto>> listMyRequests(
            @RequestParam(required = false) String status,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @AuthenticationPrincipal User actor) {
        return ResponseEntity.ok(resaleService.listMyRequests(status, actor,
                PageRequest.of(page, Math.min(size, 100))));
    }

    @GetMapping("/requests/{requestId}")
    public ResponseEntity<ResaleRequestResponseDto> getRequest(
            @PathVariable UUID requestId,
            @AuthenticationPrincipal User actor) {
        return ResponseEntity.ok(resaleService.getRequest(requestId, actor));
    }

    @DeleteMapping("/requests/{requestId}")
    public ResponseEntity<ResaleRequestResponseDto> cancelRequest(
            @PathVariable UUID requestId,
            @RequestParam(required = false) String reason,
            @AuthenticationPrincipal User actor) {
        return ResponseEntity.ok(resaleService.cancelRequest(requestId, reason, actor));
    }

    // --- Authorizations ---

    @GetMapping("/authorizations")
    public ResponseEntity<Page<ResaleAuthorizationDto>> listAuthorizations(
            @RequestParam(defaultValue = "false") boolean activeOnly,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @AuthenticationPrincipal User actor) {
        return ResponseEntity.ok(resaleService.listSellerAuthorizations(activeOnly, actor,
                PageRequest.of(page, Math.min(size, 100))));
    }

    // --- Seller Listings ---

    @PostMapping("/listings")
    public ResponseEntity<SellerProductListingDto> createListing(
            @RequestBody @Valid CreateListingDto dto,
            @AuthenticationPrincipal User actor) {
        return ResponseEntity.ok(resaleService.createListing(dto, actor));
    }

    @GetMapping("/listings")
    public ResponseEntity<Page<SellerProductListingDto>> listMyListings(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @AuthenticationPrincipal User actor) {
        return ResponseEntity.ok(resaleService.listMyListings(actor,
                PageRequest.of(page, Math.min(size, 100))));
    }

    @PutMapping("/listings/{listingId}")
    public ResponseEntity<SellerProductListingDto> updateListing(@PathVariable UUID listingId,
            @RequestBody @Valid UpdateListingDto dto, @AuthenticationPrincipal User actor) {
        return ResponseEntity.ok(resaleService.updateListing(listingId, dto, actor));
    }
}
