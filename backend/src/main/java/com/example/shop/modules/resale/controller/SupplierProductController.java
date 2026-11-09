package com.example.shop.modules.resale.controller;

import com.example.shop.common.exception.BusinessException;
import com.example.shop.modules.product.repository.ProductRepository;
import com.example.shop.modules.resale.entity.SupplierProduct;
import com.example.shop.modules.resale.repository.SupplierProductRepository;
import com.example.shop.modules.user.entity.SupplierOperatingMode;
import com.example.shop.modules.user.entity.User;
import com.example.shop.modules.user.repository.UserRepository;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import java.math.BigDecimal;
import java.util.*;

@RestController
@RequestMapping("/api/v1/supplier/products")
@PreAuthorize("hasRole('SUPPLIER')")
@RequiredArgsConstructor
public class SupplierProductController {
    private final SupplierProductRepository offers;
    private final ProductRepository products;
    private final UserRepository users;
    private final com.example.shop.modules.resale.repository.SellerProductAllocationRepository allocations;
    private final com.example.shop.modules.resale.repository.SellerResaleAuthorizationRepository authorizations;

    public record OfferRequest(@NotBlank String productId, String sku, @NotNull @Positive BigDecimal wholesalePrice,
                              @NotNull @Min(0) Integer stockQuantity, @NotNull @Positive Integer minimumOrderQuantity,
                              Boolean available, Boolean allowResale, String supplyTerms) {
        public boolean effectiveAllowResale() {
            if (allowResale != null) return allowResale;
            if (available != null) return available;
            return false;
        }
    }
    public record DirectRetailRequest(boolean enabled, @Positive BigDecimal retailPrice) { }
    public record ResaleAvailabilityRequest(boolean allowResale) { }
    public record OfferView(UUID supplierProductId, String productId, String productName, String sku,
                            BigDecimal wholesalePrice, Integer stockQuantity, Integer reservedQuantity,
                            Integer minimumOrderQuantity, Boolean approved, Boolean available, Boolean allowResale,
                            String supplyTerms, Boolean directRetailEnabled, BigDecimal directRetailPrice) {
        static OfferView from(SupplierProduct o) {
            boolean resale = Boolean.TRUE.equals(o.getAllowResale());
            return new OfferView(o.getId(), o.getProduct().getProductID(), o.getProduct().getProductName(), o.getSupplierSku(),
                    o.getWholesalePrice(), o.getStockQuantity(), o.getReservedQuantity(), o.getMinimumOrderQuantity(),
                    o.getApproved(), o.getAvailable(), resale, o.getSupplyTerms(), o.getDirectRetailEnabled(), o.getDirectRetailPrice());
        }
    }

    @GetMapping("/mine")
    @Transactional(readOnly = true)
    public List<OfferView> mine(@AuthenticationPrincipal User actor) {
        return offers.findBySupplierIdOrderByCreatedAtDesc(actor.getId()).stream().map(OfferView::from).toList();
    }

    @PostMapping
    @Transactional
    public OfferView create(@Valid @RequestBody OfferRequest body, @AuthenticationPrincipal User actor) {
        var product = products.findByProductID(body.productId()).filter(p -> Boolean.TRUE.equals(p.getActive()))
                .orElseThrow(() -> new BusinessException("Approved global product not found", HttpStatus.NOT_FOUND));
        if (!actor.getId().equals(product.getSupplierUserId()))
            throw new BusinessException("Supplier offers can only be created for products owned by your account", HttpStatus.FORBIDDEN);
        if (offers.findBySupplierIdAndProductProductID(actor.getId(), body.productId()).isPresent())
            throw new BusinessException("Supplier already has an offer for this product", HttpStatus.CONFLICT);
        boolean allowResale = body.effectiveAllowResale();
        SupplierProduct offer = SupplierProduct.builder().product(product).supplier(actor).supplierSku(body.sku())
                .wholesalePrice(body.wholesalePrice()).stockQuantity(body.stockQuantity()).reservedQuantity(0)
                .minimumOrderQuantity(body.minimumOrderQuantity()).approved(false).available(body.available() == null ? allowResale : body.available())
                .allowResale(allowResale).supplyTerms(body.supplyTerms()).directRetailEnabled(false).build();
        return OfferView.from(offers.save(offer));
    }

    @PutMapping("/{offerId}")
    @Transactional
    public OfferView update(@PathVariable UUID offerId, @Valid @RequestBody OfferRequest body, @AuthenticationPrincipal User actor) {
        SupplierProduct offer = offers.findDetailedByIdForUpdate(offerId).orElseThrow(() -> new BusinessException("Supplier offer not found", HttpStatus.NOT_FOUND));
        if (!offer.getSupplier().getId().equals(actor.getId())) throw new BusinessException("Access denied", HttpStatus.FORBIDDEN);
        if (!offer.getProduct().getProductID().equals(body.productId())) throw new BusinessException("Offer global product is immutable", HttpStatus.BAD_REQUEST);
        long unlistedApproved = Optional.ofNullable(authorizations.sumUnlistedApprovedAllocationsForOffer(actor.getId(), offerId)).orElse(0L);
        long committed = Optional.ofNullable(allocations.sumRemainingForOffer(offerId)).orElse(0L) + unlistedApproved + offer.getReservedQuantity();
        if (body.stockQuantity() < committed) throw new BusinessException("Stock cannot be lower than existing Seller allocations and reservations", HttpStatus.CONFLICT);
        offer.setSupplierSku(body.sku()); offer.setWholesalePrice(body.wholesalePrice()); offer.setStockQuantity(body.stockQuantity());
        if (offer.getReservedQuantity() > offer.getStockQuantity()) throw new BusinessException("Stock cannot be lower than reserved quantity", HttpStatus.CONFLICT);
        offer.setMinimumOrderQuantity(body.minimumOrderQuantity());
        boolean allowResale = body.effectiveAllowResale();
        offer.setAvailable(body.available() == null ? allowResale : body.available());
        offer.setAllowResale(allowResale);
        offer.setSupplyTerms(body.supplyTerms());
        return OfferView.from(offers.save(offer));
    }

    @PutMapping("/{offerId}/allow-resale")
    @Transactional
    public OfferView setAllowResale(@PathVariable UUID offerId, @RequestBody ResaleAvailabilityRequest body, @AuthenticationPrincipal User actor) {
        SupplierProduct offer = owned(offerId, actor);
        offer.setAvailable(body.allowResale());
        offer.setAllowResale(body.allowResale());
        return OfferView.from(offers.save(offer));
    }

    @PutMapping("/{offerId}/direct-retail")
    @Transactional
    public OfferView directRetail(@PathVariable UUID offerId, @Valid @RequestBody DirectRetailRequest body, @AuthenticationPrincipal User actor) {
        SupplierProduct offer = owned(offerId, actor);
        SupplierOperatingMode currentMode = users.findById(actor.getId()).map(User::getSupplierOperatingMode).orElse(SupplierOperatingMode.SUPPLY_ONLY);
        if (currentMode != SupplierOperatingMode.SUPPLY_AND_SELL)
            throw new BusinessException("SUPPLY_ONLY suppliers cannot create direct retail listings", HttpStatus.FORBIDDEN);
        if (body.enabled() && body.retailPrice() == null) throw new BusinessException("Retail price is required", HttpStatus.BAD_REQUEST);
        offer.setDirectRetailEnabled(body.enabled()); offer.setDirectRetailPrice(body.enabled() ? body.retailPrice() : null);
        return OfferView.from(offers.save(offer));
    }

    private SupplierProduct owned(UUID id, User actor) {
        SupplierProduct offer = offers.findDetailedById(id).orElseThrow(() -> new BusinessException("Supplier offer not found", HttpStatus.NOT_FOUND));
        if (!offer.getSupplier().getId().equals(actor.getId())) throw new BusinessException("Access denied", HttpStatus.FORBIDDEN);
        return offer;
    }
}
