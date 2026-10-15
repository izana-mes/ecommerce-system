package com.example.shop.modules.ai.service;

import com.example.shop.modules.coupon.entity.Coupon;
import com.example.shop.modules.coupon.repository.CouponRepository;
import com.example.shop.modules.order.dto.OrderHistoryItemDto;
import com.example.shop.modules.order.service.OrderService;
import com.example.shop.modules.product.dto.ProductDto;
import com.example.shop.modules.product.service.ProductService;
import com.example.shop.modules.review.dto.ProductReviewDto;
import com.example.shop.modules.review.dto.ProductReviewSummaryDto;
import com.example.shop.modules.review.service.ProductReviewService;
import com.example.shop.modules.role.entity.Role;
import com.example.shop.modules.user.entity.User;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class AiRagServiceTest {

    private ProductService productService;
    private OrderService orderService;
    private CouponRepository couponRepository;
    private ProductReviewService productReviewService;
    private AiRagService ragService;

    @BeforeEach
    void setUp() {
        productService = mock(ProductService.class);
        orderService = mock(OrderService.class);
        couponRepository = mock(CouponRepository.class);
        productReviewService = mock(ProductReviewService.class);
        ragService = new AiRagService(productService, orderService, couponRepository, productReviewService);
    }

    @Test
    void retrievesProductFactsCorrectly() {
        ProductDto jacket = new ProductDto();
        jacket.setProductID("1");
        jacket.setProductName("Cropped Faux Leather Jacket");
        jacket.setCategory("Jackets");
        jacket.setProductPrice(29.0);
        jacket.setStockQuantity(23);
        jacket.setActive(true);

        when(productService.searchProducts(anyString())).thenAnswer(inv -> {
            String q = inv.getArgument(0);
            return q.toLowerCase().contains("leather") ? List.of(jacket) : List.of();
        });

        AiRagService.RagContext context = ragService.retrieveContext("How much is the Cropped Faux Leather Jacket?", null, null);

        assertNotNull(context);
        assertFalse(context.retrievedProducts().isEmpty());
        assertEquals("Cropped Faux Leather Jacket", context.retrievedProducts().get(0).getProductName());
        assertTrue(context.groundedContextPrompt().contains("Cropped Faux Leather Jacket"));
        assertTrue(context.groundedContextPrompt().contains("$29.00"));
        assertTrue(context.groundedContextPrompt().contains("IN STOCK"));
    }

    @Test
    void blocksOrderLookupForUnauthenticatedUser() {
        AiRagService.RagContext context = ragService.retrieveContext("Where is my order ORD-12345?", null, null);

        assertNotNull(context);
        assertTrue(context.askedAboutOrdersWithoutAuth());
        assertTrue(context.groundedContextPrompt().contains("The user is NOT logged in"));
        verifyNoInteractions(orderService);
    }

    @Test
    void allowsOrderLookupForAuthenticatedUser() {
        User user = User.builder()
                .id(UUID.randomUUID())
                .email("shopper@example.com")
                .roles(List.of(Role.builder().name("ROLE_USER").build()))
                .build();

        OrderHistoryItemDto order = OrderHistoryItemDto.builder()
                .id(1L)
                .orderNumber("ORD-12345")
                .totalAmount(BigDecimal.valueOf(58.00))
                .orderStatus("SHIPPED")
                .paymentMethod("COD")
                .paymentStatus("PAID")
                .build();

        when(orderService.getMyOrders(user, 5)).thenReturn(List.of(order));

        AiRagService.RagContext context = ragService.retrieveContext("Where is my order?", user, null);

        assertNotNull(context);
        assertFalse(context.askedAboutOrdersWithoutAuth());
        assertTrue(context.groundedContextPrompt().contains("ORD-12345"));
        assertTrue(context.groundedContextPrompt().contains("SHIPPED"));
        verify(orderService).getMyOrders(user, 5);
    }

    @Test
    void retrievesActiveCouponsWhenAsked() {
        Coupon coupon = Coupon.builder()
                .id(1L)
                .code("SUMMER20")
                .title("20% Summer Sale")
                .discountType("percentage")
                .discountValue(BigDecimal.valueOf(20))
                .minOrderAmount(BigDecimal.valueOf(50))
                .isActive(true)
                .build();

        when(couponRepository.findByIsActiveTrue()).thenReturn(List.of(coupon));

        AiRagService.RagContext context = ragService.retrieveContext("Do you have any discount coupons or promos?", null, null);

        assertNotNull(context);
        assertTrue(context.groundedContextPrompt().contains("SUMMER20"));
        assertTrue(context.groundedContextPrompt().contains("20% Summer Sale"));
    }
}
