package com.example.shop.modules.resale;

import com.example.shop.common.exception.BusinessException;
import com.example.shop.modules.product.entity.Product;
import com.example.shop.modules.resale.entity.*;
import com.example.shop.modules.resale.repository.SellerProductListingRepository;
import com.example.shop.modules.resale.repository.SupplierProductRepository;
import com.example.shop.modules.resale.repository.SellerProductAllocationRepository;
import com.example.shop.modules.resale.service.SellerListingCatalog;
import com.example.shop.modules.user.entity.SupplierOperatingMode;
import com.example.shop.modules.user.entity.User;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import java.math.BigDecimal;
import java.util.Optional;
import java.util.UUID;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

class SellerListingCatalogTest {
    private SellerProductListingRepository listings;
    private SupplierProductRepository offers;
    private SellerProductAllocationRepository allocations;
    private SellerListingCatalog catalog;
    private SellerProductListing listing;
    private SupplierProduct offer;
    private SellerResaleAuthorization authorization;
    private UUID offerId;

    @BeforeEach void setUp() {
        listings = mock(SellerProductListingRepository.class);
        offers = mock(SupplierProductRepository.class);
        allocations = mock(SellerProductAllocationRepository.class);
        catalog = new SellerListingCatalog(listings, offers, allocations);
        offerId = UUID.randomUUID();
        User seller = User.builder().id(UUID.randomUUID()).build();
        User supplier = User.builder().id(UUID.randomUUID()).supplierOperatingMode(SupplierOperatingMode.SUPPLY_ONLY).build();
        Product product = Product.builder().id(1L).productID("GLOBAL-1").productName("Coffee").active(true).productPrice(999D).build();
        offer = SupplierProduct.builder().id(offerId).product(product).supplier(supplier).wholesalePrice(new BigDecimal("8.00"))
                .stockQuantity(10).reservedQuantity(2).minimumOrderQuantity(2).approved(true).available(true).allowResale(true).build();
        authorization = SellerResaleAuthorization.builder().active(true).seller(seller).supplierUserId(supplier.getId()).supplierOffer(offer).build();
        listing = SellerProductListing.builder().id(UUID.randomUUID()).seller(seller).supplierUserId(supplier.getId())
                .supplierProductId("GLOBAL-1").supplierOffer(offer).authorization(authorization).active(true)
                .customTitle("Seller coffee").retailPrice(new BigDecimal("15.50")).build();
        when(allocations.findByListingId(listing.getId())).thenReturn(Optional.of(SellerProductAllocation.builder()
                .listing(listing).supplierOffer(offer).sellerUserId(seller.getId()).supplierUserId(supplier.getId())
                .allocatedQuantity(10).soldQuantity(1).reservedQuantity(1).status("ACTIVE").build()));
        when(listings.findById(listing.getId())).thenReturn(Optional.of(listing));
        when(offers.findDetailedById(offerId)).thenReturn(Optional.of(offer));
    }

    @Test void sellerListingUsesSellerRetailPriceAndSupplierOfferInventory() {
        String key = "LISTING:" + listing.getId();
        var resolved = catalog.resolve(key);
        Product customerProduct = catalog.retailProduct(resolved, key);
        assertThat(customerProduct.getProductID()).isEqualTo(key);
        assertThat(customerProduct.getProductName()).isEqualTo("Seller coffee");
        assertThat(customerProduct.getProductPrice()).isEqualTo(15.50D);
        assertThat(customerProduct.getStockQuantity()).isEqualTo(8);
        assertThat(customerProduct.getSellerUserId()).isEqualTo(listing.getSeller().getId());
        assertThat(customerProduct.getSupplierUserId()).isEqualTo(offer.getSupplier().getId());
    }

    @Test void inactiveListingOrInactiveAuthorizationCannotReachCustomerCatalog() {
        listing.setActive(false);
        assertThatThrownBy(() -> catalog.resolve("LISTING:" + listing.getId())).isInstanceOf(BusinessException.class);
        listing.setActive(true);
        listing.getAuthorization().setActive(false);
        assertThatThrownBy(() -> catalog.resolve("LISTING:" + listing.getId())).isInstanceOf(BusinessException.class);
    }

    @Test void supplyOnlySupplierCannotExposeDirectRetailOffer() {
        offer.setDirectRetailEnabled(true);
        offer.setDirectRetailPrice(new BigDecimal("14.00"));
        assertThatThrownBy(() -> catalog.resolveDirectOffer("SUPPLIER:" + offerId)).isInstanceOf(BusinessException.class);
    }

    @Test void disablingAllowResaleBlocksNewPurchasesFromExistingListing() {
        offer.setAvailable(false);
        offer.setAllowResale(false);
        String key = "LISTING:" + listing.getId();
        assertThatThrownBy(() -> catalog.resolve(key)).isInstanceOf(BusinessException.class);
    }

    @Test void zeroAvailableSupplierStockHidesSellerListingFromCustomerCatalog() {
        offer.setStockQuantity(0);
        offer.setReservedQuantity(0);
        allocations.findByListingId(listing.getId()).ifPresent(a -> a.setAllocatedQuantity(0));
        assertThatThrownBy(() -> catalog.resolve("LISTING:" + listing.getId()))
                .isInstanceOf(BusinessException.class);
    }

    @Test void multipleSellersCanSellSameSupplierProductWithDifferentRetailPrices() {
        User secondSeller = User.builder().id(UUID.randomUUID()).build();
        SellerResaleAuthorization secondAuth = SellerResaleAuthorization.builder().active(true).seller(secondSeller)
                .supplierUserId(offer.getSupplier().getId()).supplierOffer(offer).build();
        SellerProductListing secondListing = SellerProductListing.builder()
                .id(UUID.randomUUID())
                .seller(secondSeller)
                .supplierUserId(offer.getSupplier().getId())
                .supplierProductId("GLOBAL-1")
                .supplierOffer(offer)
                .authorization(secondAuth)
                .active(true)
                .customTitle("Premium Artisan Coffee")
                .retailPrice(new BigDecimal("22.00"))
                .build();

        when(listings.findById(secondListing.getId())).thenReturn(Optional.of(secondListing));
        when(allocations.findByListingId(secondListing.getId())).thenReturn(Optional.of(SellerProductAllocation.builder()
                .listing(secondListing).supplierOffer(offer).allocatedQuantity(10).soldQuantity(1).reservedQuantity(1).status("ACTIVE").build()));

        String key1 = "LISTING:" + listing.getId();
        String key2 = "LISTING:" + secondListing.getId();

        Product prod1 = catalog.retailProduct(catalog.resolve(key1), key1);
        Product prod2 = catalog.retailProduct(catalog.resolve(key2), key2);

        // Both link to the same wholesale supplier offer inventory
        assertThat(prod1.getStockQuantity()).isEqualTo(8);
        assertThat(prod2.getStockQuantity()).isEqualTo(8);

        // Different seller retail prices and identities
        assertThat(prod1.getProductPrice()).isEqualTo(15.50D);
        assertThat(prod2.getProductPrice()).isEqualTo(22.00D);
        assertThat(prod1.getSellerUserId()).isNotEqualTo(prod2.getSellerUserId());
        assertThat(prod1.getSupplierUserId()).isEqualTo(prod2.getSupplierUserId());
    }
}
