package com.example.shop.modules.resale.service;

import com.example.shop.modules.resale.dto.*;
import com.example.shop.modules.user.entity.User;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import java.util.List;
import java.util.UUID;

public interface ResaleService {

    // === Supplier Catalog Management ===
    SupplierResaleCatalogFlagDto setResaleFlag(String productId, boolean enabled, String commercialNote, User supplier);
    SupplierResaleCatalogFlagDto setResaleTerms(String productId, boolean enabled, String commercialNote, java.math.BigDecimal wholesalePrice, Integer minimumOrderQuantity, User supplier);
    void approveSupplierCatalogProduct(String productId);
    Page<SupplierResaleCatalogFlagDto> adminListPendingSupplierProducts(Pageable pageable);
    List<SupplierResaleCatalogFlagDto> listSupplierCatalogFlags(User supplier);

    // === Seller: Browse Catalog ===
    Page<SupplierCatalogProductDto> browseSupplierCatalog(UUID supplierFilter, String category, String q, String brand, String sku, User seller, Pageable pageable);

    // === Seller: Resale Requests ===
    ResaleRequestResponseDto submitRequest(SubmitResaleRequestDto dto, User seller);
    Page<ResaleRequestResponseDto> listMyRequests(String status, User seller, Pageable pageable);
    ResaleRequestResponseDto getRequest(UUID requestId, User actor);
    ResaleRequestResponseDto cancelRequest(UUID requestId, String reason, User seller);

    // === Supplier: Review Requests ===
    Page<ResaleRequestResponseDto> listIncomingRequests(String status, String productId, User supplier, Pageable pageable);
    ResaleRequestResponseDto acceptRequest(UUID requestId, String note, User supplier);
    ResaleRequestResponseDto acceptRequest(UUID requestId, String note, Integer initialAllocationQuantity, User supplier);
    ResaleRequestResponseDto rejectRequest(UUID requestId, String note, User supplier);
    SellerProfileDto getSellerProfileForSupplier(UUID sellerId, User supplier);

    // === Authorizations ===
    Page<ResaleAuthorizationDto> listSellerAuthorizations(boolean activeOnly, User seller, Pageable pageable);
    Page<ResaleAuthorizationDto> listSupplierAuthorizations(boolean activeOnly, User supplier, Pageable pageable);
    ResaleAuthorizationDto revokeAuthorization(UUID authorizationId, String reason, User supplier);

    // === Seller Listings ===
    SellerProductListingDto createListing(CreateListingDto dto, User seller);
    Page<SellerProductListingDto> listMyListings(User seller, Pageable pageable);
    SellerProductListingDto updateListing(UUID listingId, UpdateListingDto dto, User seller);

    // === Admin ===
    Page<ResaleRequestResponseDto> adminListAllRequests(String status, Pageable pageable);
    Page<ResaleAuthorizationDto> adminListAllAuthorizations(Pageable pageable);

    // === Public Profile ===
    SupplierPublicProfileDto getSupplierPublicProfile(UUID supplierId);
}
