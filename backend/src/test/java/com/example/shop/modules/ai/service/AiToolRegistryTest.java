package com.example.shop.modules.ai.service;

import com.example.shop.modules.cart.service.CartService;
import com.example.shop.modules.order.service.OrderService;
import com.example.shop.modules.product.service.ProductService;
import com.example.shop.modules.review.service.ProductReviewService;
import com.example.shop.modules.admin.service.AdminDashboardService;
import com.example.shop.modules.role.entity.Role;
import com.example.shop.modules.user.entity.User;
import com.example.shop.modules.wishlist.service.WishlistService;
import org.junit.jupiter.api.Test;
import org.springframework.security.access.AccessDeniedException;
import java.util.List;
import java.util.Map;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.*;

class AiToolRegistryTest {
    private AiToolRegistry registry() { return new AiToolRegistry(mock(ProductService.class), mock(OrderService.class), mock(CartService.class), mock(WishlistService.class), mock(ProductReviewService.class), mock(AdminDashboardService.class)); }
    @Test void rejectsUnknownToolsIncludingSqlInjection() { assertThrows(IllegalArgumentException.class, () -> registry().execute("SELECT * FROM users", Map.of(), null)); }
    @Test void blocksAdminDataForCustomer() { User customer=User.builder().roles(List.of(Role.builder().name("ROLE_USER").build())).build(); assertThrows(AccessDeniedException.class, () -> registry().execute("get_sales_summary", Map.of(), customer)); }
    @Test void scopesOrderLookupToAuthenticatedUser() {
        ProductService products=mock(ProductService.class); OrderService orders=mock(OrderService.class);
        AiToolRegistry tools=new AiToolRegistry(products, orders, mock(CartService.class), mock(WishlistService.class), mock(ProductReviewService.class), mock(AdminDashboardService.class));
        User customer=User.builder().roles(List.of(Role.builder().name("ROLE_USER").build())).build();
        tools.execute("get_my_orders", Map.of("query", "another-user-id"), customer);
        verify(orders).getMyOrders(customer, 5);
        verifyNoMoreInteractions(orders);
    }
}
