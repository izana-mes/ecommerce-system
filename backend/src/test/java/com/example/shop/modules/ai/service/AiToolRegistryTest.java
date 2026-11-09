package com.example.shop.modules.ai.service;

import com.example.shop.modules.admin.service.AdminDashboardService;
import com.example.shop.modules.cart.service.CartService;
import com.example.shop.modules.order.service.OrderService;
import com.example.shop.modules.product.service.ProductService;
import com.example.shop.modules.productapproval.repository.ProductChangeRequestRepository;
import com.example.shop.modules.resale.repository.SellerProductAllocationRepository;
import com.example.shop.modules.resale.repository.SupplierProductRepository;
import com.example.shop.modules.resale.service.ResaleService;
import com.example.shop.modules.review.service.ProductReviewService;
import com.example.shop.modules.role.entity.Role;
import com.example.shop.modules.seller.catalog.service.SellerCatalogService;
import com.example.shop.modules.seller.dashboard.service.SellerDashboardService;
import com.example.shop.modules.seller.order.service.SellerOrderService;
import com.example.shop.modules.shipper.service.ShipperRealtimeService;
import com.example.shop.modules.supplier.dashboard.service.SupplierDashboardService;
import com.example.shop.modules.user.entity.User;
import com.example.shop.modules.wishlist.service.WishlistService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.AccessDeniedException;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class AiToolRegistryTest {
    @Mock ProductService products;
    @Mock OrderService orders;
    @Mock CartService carts;
    @Mock WishlistService wishlist;
    @Mock ProductReviewService reviews;
    @Mock AdminDashboardService dashboard;
    @Mock SellerDashboardService sellerDashboard;
    @Mock SupplierDashboardService supplierDashboard;
    @Mock SellerOrderService sellerOrders;
    @Mock SellerCatalogService sellerCatalog;
    @Mock ResaleService resale;
    @Mock SellerProductAllocationRepository allocations;
    @Mock SupplierProductRepository supplierProducts;
    @Mock ShipperRealtimeService shipper;
    @Mock ProductChangeRequestRepository productChangeRequests;
    @Mock JdbcTemplate jdbc;
    @InjectMocks AiToolRegistry registry;

    private User seller;
    private User supplier;

    @BeforeEach void setUp() {
        seller = user("ROLE_SELLER");
        supplier = user("ROLE_SUPPLIER");
    }

    @Test void managementToolDefinitionsAreRoleSpecificAndNeverExposeCustomerTools() {
        var sellerNames = registry.definitions(seller).stream().map(d -> d.name()).toList();
        var supplierNames = registry.definitions(supplier).stream().map(d -> d.name()).toList();
        assertThat(sellerNames).contains("search_supplier_offers", "get_seller_allocations", "get_seller_orders")
                .doesNotContain("get_my_cart", "get_my_orders", "get_admin_operations", "get_supplier_inventory");
        assertThat(supplierNames).contains("get_supplier_requests", "get_supplier_allocations", "get_supplier_inventory")
                .doesNotContain("get_my_cart", "get_my_orders", "get_seller_orders", "get_admin_operations");
    }

    @Test void sellerOrdersAlwaysUseAuthenticatedSellerIdAndIgnoreCallerSuppliedOwner() {
        registry.execute("get_seller_orders", Map.of("sellerId", UUID.randomUUID().toString()), seller);
        verify(sellerOrders).listOrdersForSeller(seller.getId(), 20, null);
        verifyNoInteractions(carts, wishlist);
    }

    @Test void supplierAllocationsAlwaysUseAuthenticatedSupplierIdAndSellerToolsAreDenied() {
        registry.execute("get_supplier_allocations", Map.of("supplierId", UUID.randomUUID().toString()), supplier);
        verify(allocations).findAllForSupplier(supplier.getId());
        assertThatThrownBy(() -> registry.execute("get_seller_orders", Map.of(), supplier))
                .isInstanceOf(AccessDeniedException.class);
        verifyNoMoreInteractions(allocations);
    }

    @Test void managementRoleCannotExecuteCustomerCartTool() {
        assertThatThrownBy(() -> registry.execute("get_my_cart", Map.of(), seller))
                .isInstanceOf(AccessDeniedException.class);
        verifyNoInteractions(carts);
    }

    private User user(String role) {
        return User.builder().id(UUID.randomUUID()).email("role@example.test")
                .roles(List.of(Role.builder().name(role).build())).build();
    }
}
