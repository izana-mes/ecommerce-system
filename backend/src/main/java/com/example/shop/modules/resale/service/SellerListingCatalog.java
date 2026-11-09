package com.example.shop.modules.resale.service;

import com.example.shop.common.exception.BusinessException;
import com.example.shop.modules.product.entity.Product;
import com.example.shop.modules.resale.entity.SellerProductListing;
import com.example.shop.modules.resale.repository.SellerProductListingRepository;
import com.example.shop.modules.resale.repository.SupplierProductRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import java.util.UUID;
import java.util.Objects;

@Service
public class SellerListingCatalog {
    private final SellerProductListingRepository listings;
    private final SupplierProductRepository offers;
    private final com.example.shop.modules.resale.repository.SellerProductAllocationRepository allocations;
    public SellerListingCatalog(SellerProductListingRepository listings, SupplierProductRepository offers, com.example.shop.modules.resale.repository.SellerProductAllocationRepository allocations) { this.listings = listings; this.offers = offers; this.allocations = allocations; }

    public SellerProductListing resolve(String catalogId) {
        if (catalogId == null || !catalogId.startsWith("LISTING:")) return null;
        UUID id;
        try { id = UUID.fromString(catalogId.substring("LISTING:".length())); }
        catch (IllegalArgumentException ex) { throw new BusinessException("Listing not found", HttpStatus.NOT_FOUND); }
        SellerProductListing listing = listings.findById(id).orElseThrow(() -> new BusinessException("Listing not found", HttpStatus.NOT_FOUND));
        if (!Boolean.TRUE.equals(listing.getActive()) || !Boolean.TRUE.equals(listing.getAuthorization().getActive())
                || !listing.getSeller().getId().equals(listing.getAuthorization().getSeller().getId())
                || !listing.getSupplierUserId().equals(listing.getAuthorization().getSupplierUserId())
                || !Objects.equals(listing.getSupplierOffer() == null ? null : listing.getSupplierOffer().getId(),
                        listing.getAuthorization().getSupplierOffer() == null ? null : listing.getAuthorization().getSupplierOffer().getId())
                || listing.getSupplierOffer() == null)
            throw new BusinessException("Seller listing is unavailable", HttpStatus.CONFLICT);
        var offer = offers.findDetailedById(listing.getSupplierOffer().getId()).orElseThrow(() -> new BusinessException("Supplier offer unavailable", HttpStatus.CONFLICT));
        var allocation = allocations.findByListingId(listing.getId()).orElseThrow(() -> new BusinessException("Seller allocation unavailable", HttpStatus.CONFLICT));
        if (!Boolean.TRUE.equals(offer.getProduct().getActive()) || !offer.getSupplier().getId().equals(listing.getSupplierUserId()) || !Boolean.TRUE.equals(offer.getApproved())
                || !Boolean.TRUE.equals(offer.getAvailable()) || !Boolean.TRUE.equals(offer.getAllowResale())
                || !"ACTIVE".equals(allocation.getStatus()) || allocation.remaining() < offer.getMinimumOrderQuantity())
            throw new BusinessException("Supplier offer unavailable", HttpStatus.CONFLICT);
        return listing;
    }

    public com.example.shop.modules.resale.entity.SupplierProduct resolveDirectOffer(String catalogId) {
        if (catalogId == null || !catalogId.startsWith("SUPPLIER:")) return null;
        UUID id;
        try { id = UUID.fromString(catalogId.substring("SUPPLIER:".length())); }
        catch (IllegalArgumentException ex) { throw new BusinessException("Supplier offer not found", HttpStatus.NOT_FOUND); }
        var offer = offers.findDetailedById(id).orElseThrow(() -> new BusinessException("Supplier offer not found", HttpStatus.NOT_FOUND));
        if (!Boolean.TRUE.equals(offer.getProduct().getActive()) || !Boolean.TRUE.equals(offer.getApproved()) || !Boolean.TRUE.equals(offer.getAvailable())
                || !Boolean.TRUE.equals(offer.getDirectRetailEnabled()) || offer.getDirectRetailPrice() == null
                || offer.getStockQuantity() - offer.getReservedQuantity() < offer.getMinimumOrderQuantity()
                || offer.getSupplier().getSupplierOperatingMode() != com.example.shop.modules.user.entity.SupplierOperatingMode.SUPPLY_AND_SELL)
            throw new BusinessException("Supplier direct retail offer unavailable", HttpStatus.CONFLICT);
        return offer;
    }

    public Product directRetailProduct(com.example.shop.modules.resale.entity.SupplierProduct offer, String catalogId) {
        Product source = offer.getProduct();
        return Product.builder().id(source.getId()).productID(catalogId).frontImg(source.getFrontImg()).backImg(source.getBackImg())
                .productName(source.getProductName()).productPrice(offer.getDirectRetailPrice().doubleValue()).oldPrice(source.getOldPrice())
                .productReviews(source.getProductReviews()).category(source.getCategory()).sku(offer.getSupplierSku()).brand(source.getBrand())
                .sizes(source.getSizes()).stockQuantity(Math.max(0, offer.getStockQuantity() - offer.getReservedQuantity())).active(true)
                .supplierUserId(offer.getSupplier().getId()).build();
    }

    public int minimumOrderQuantity(String catalogId) {
        if (catalogId == null) return 1;
        if (catalogId.startsWith("LISTING:")) return resolve(catalogId).getSupplierOffer().getMinimumOrderQuantity();
        if (catalogId.startsWith("SUPPLIER:")) return resolveDirectOffer(catalogId).getMinimumOrderQuantity();
        return 1;
    }

    public int availableQuantity(SellerProductListing listing) {
        return allocations.findByListingId(listing.getId()).map(a -> Math.max(0, a.remaining())).orElse(0);
    }

    public Product retailProduct(SellerProductListing listing, String catalogId) {
        Product source = listing.getSupplierOffer().getProduct();
        int sellable = allocations.findByListingId(listing.getId()).map(a -> Math.max(0, a.remaining())).orElse(0);
        return Product.builder().id(source.getId()).productID(catalogId).frontImg(source.getFrontImg()).backImg(source.getBackImg())
                .productName(listing.getCustomTitle() == null || listing.getCustomTitle().isBlank() ? source.getProductName() : listing.getCustomTitle())
                .productPrice(listing.getRetailPrice().doubleValue()).oldPrice(source.getOldPrice()).productReviews(source.getProductReviews())
                .category(source.getCategory()).sku(listing.getSupplierOffer().getSupplierSku()).brand(source.getBrand()).sizes(source.getSizes())
                .stockQuantity(sellable)
                .active(true).sellerUserId(listing.getSeller().getId()).supplierUserId(listing.getSupplierUserId()).build();
    }
}
