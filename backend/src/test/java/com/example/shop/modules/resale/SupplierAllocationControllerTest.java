package com.example.shop.modules.resale;

import com.example.shop.common.exception.BusinessException;
import com.example.shop.modules.notification.service.CustomerNotificationService;
import com.example.shop.modules.product.entity.Product;
import com.example.shop.modules.resale.controller.SupplierAllocationController;
import com.example.shop.modules.resale.entity.SellerProductAllocation;
import com.example.shop.modules.resale.entity.SellerProductListing;
import com.example.shop.modules.resale.entity.SupplierProduct;
import com.example.shop.modules.resale.repository.SellerProductAllocationRepository;
import com.example.shop.modules.user.entity.User;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.*;

class SupplierAllocationControllerTest {
    private SellerProductAllocationRepository allocations;
    private JdbcTemplate jdbc;
    private SupplierAllocationController controller;
    private UUID supplierA;
    private UUID supplierB;

    @BeforeEach
    void setUp() {
        allocations = mock(SellerProductAllocationRepository.class);
        jdbc = mock(JdbcTemplate.class);
        controller = new SupplierAllocationController(allocations, jdbc, mock(CustomerNotificationService.class));
        supplierA = UUID.randomUUID();
        supplierB = UUID.randomUUID();
    }

    @Test
    void listsOnlyAllocationsSelectedForAuthenticatedSupplierAndMapsQuantities() {
        when(allocations.findAllForSupplier(supplierA)).thenReturn(List.of(allocation(12, 3, 2)));

        var result = controller.list(supplier(supplierA));

        assertThat(result).hasSize(1);
        assertThat(result.getFirst()).satisfies(dto -> {
            assertThat(dto.allocated()).isEqualTo(12);
            assertThat(dto.sold()).isEqualTo(3);
            assertThat(dto.reserved()).isEqualTo(2);
            assertThat(dto.remaining()).isEqualTo(7);
            assertThat(dto.sellerName()).isEqualTo("seller@example.com");
            assertThat(dto.productName()).isEqualTo("Product A");
        });
        verify(allocations).findAllForSupplier(supplierA);
        verify(allocations, never()).findAllForSupplier(supplierB);
    }

    @Test
    void returnsEmptyListWithSuccessSemanticsWhenSupplierHasNoAllocations() {
        when(allocations.findAllForSupplier(supplierA)).thenReturn(List.of());
        assertThat(controller.list(supplier(supplierA))).isEmpty();
    }

    @Test
    void mapsMissingListingOfferProductAndSellerWithoutLazyRelationshipDereferences() {
        SellerProductAllocation missingRelations = SellerProductAllocation.builder()
                .id(UUID.randomUUID()).supplierUserId(supplierA).sellerUserId(UUID.randomUUID())
                .allocatedQuantity(4).soldQuantity(1).reservedQuantity(1).status("ACTIVE").build();
        when(allocations.findAllForSupplier(supplierA)).thenReturn(List.of(missingRelations));

        var dto = controller.list(supplier(supplierA)).getFirst();

        assertThat(dto.listingId()).isNull();
        assertThat(dto.productId()).isNull();
        assertThat(dto.productName()).isNull();
        assertThat(dto.sellerName()).isNull();
        assertThat(dto.remaining()).isEqualTo(2);
    }

    @Test
    void rejectsMissingSupplierAndInconsistentStoredQuantities() {
        assertThatThrownBy(() -> controller.list(null))
                .isInstanceOfSatisfying(BusinessException.class, ex -> assertThat(ex.getStatus()).isEqualTo(HttpStatus.UNAUTHORIZED));

        when(allocations.findAllForSupplier(supplierA)).thenReturn(List.of(allocation(5, 3, 3)));
        assertThatThrownBy(() -> controller.list(supplier(supplierA)))
                .isInstanceOfSatisfying(BusinessException.class, ex -> assertThat(ex.getStatus()).isEqualTo(HttpStatus.CONFLICT));
    }

    @Test
    void historyAndUpdateRejectAllocationsOwnedByAnotherSupplier() {
        SellerProductAllocation allocation = allocation(10, 1, 1);
        when(allocations.findByListingId(allocation.getListing().getId())).thenReturn(Optional.of(allocation));
        var listingId = allocation.getListing().getId();

        assertThatThrownBy(() -> controller.history(listingId, supplier(supplierB)))
                .isInstanceOfSatisfying(BusinessException.class, ex -> assertThat(ex.getStatus()).isEqualTo(HttpStatus.FORBIDDEN));
        assertThatThrownBy(() -> controller.update(listingId, new SupplierAllocationController.UpdateAllocation(10, "test"), supplier(supplierB)))
                .isInstanceOfSatisfying(BusinessException.class, ex -> assertThat(ex.getStatus()).isEqualTo(HttpStatus.FORBIDDEN));
        verifyNoInteractions(jdbc);
    }

    private User supplier(UUID id) {
        return User.builder().id(id).email("supplier@example.com").build();
    }

    private SellerProductAllocation allocation(int allocated, int sold, int reserved) {
        User seller = User.builder().id(UUID.randomUUID()).email("seller@example.com").build();
        Product product = Product.builder().productID("P-1").productName("Product A").build();
        SupplierProduct offer = SupplierProduct.builder().id(UUID.randomUUID()).product(product).build();
        SellerProductListing listing = SellerProductListing.builder().id(UUID.randomUUID()).supplierProductId("P-1").seller(seller).supplierOffer(offer).build();
        return SellerProductAllocation.builder().id(UUID.randomUUID()).listing(listing).supplierOffer(offer)
                .sellerUserId(seller.getId()).supplierUserId(supplierA)
                .allocatedQuantity(allocated).soldQuantity(sold).reservedQuantity(reserved).status("ACTIVE").build();
    }
}
