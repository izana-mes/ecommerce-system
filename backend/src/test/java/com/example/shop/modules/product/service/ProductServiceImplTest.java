package com.example.shop.modules.product.service;

import com.example.shop.config.CacheInvalidationEventPublisher;
import com.example.shop.modules.cart.repository.CartItemRepository;
import com.example.shop.modules.messaging.inventory.LowStockAlertEvent;
import com.example.shop.modules.messaging.inventory.LowStockAlertPublisher;
import com.example.shop.modules.product.dto.StockAdjustmentItemDto;
import com.example.shop.modules.product.entity.Product;
import com.example.shop.modules.product.mapper.ProductMapper;
import com.example.shop.modules.product.repository.ProductRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;

class ProductServiceImplTest {

    private ProductRepository productRepository;
    private ProductMapper productMapper;
    private CartItemRepository cartItemRepository;
    private CacheInvalidationEventPublisher cacheInvalidationEventPublisher;
    private LowStockAlertPublisher lowStockAlertPublisher;
    private ProductServiceImpl productService;

    @BeforeEach
    void setUp() {
        productRepository = mock(ProductRepository.class);
        productMapper = mock(ProductMapper.class);
        cartItemRepository = mock(CartItemRepository.class);
        cacheInvalidationEventPublisher = mock(CacheInvalidationEventPublisher.class);
        lowStockAlertPublisher = mock(LowStockAlertPublisher.class);

        productService = new ProductServiceImpl(
                productRepository,
                productMapper,
                cartItemRepository,
                cacheInvalidationEventPublisher,
                lowStockAlertPublisher
        );
        ReflectionTestUtils.setField(productService, "lowStockThreshold", 5);
    }

    @Test
    void validateAndReserveStockPublishesLowStockAlertWhenRemainingAtOrBelowThreshold() {
        Product product = Product.builder()
                .productID("P-100")
                .productName("Wireless Mouse")
                .stockQuantity(8)
                .active(true)
                .build();

        when(productRepository.findByProductIDIn(List.of("P-100")))
                .thenReturn(List.of(product));

        StockAdjustmentItemDto item = new StockAdjustmentItemDto();
        item.setProductID("P-100");
        item.setQuantity(5); // remaining will be 3 <= threshold 5

        productService.validateAndReserveStock(List.of(item));

        assertThat(product.getStockQuantity()).isEqualTo(3);
        verify(productRepository).saveAll(List.of(product));
        verify(cacheInvalidationEventPublisher).publish(anyList());

        ArgumentCaptor<LowStockAlertEvent> eventCaptor = ArgumentCaptor.forClass(LowStockAlertEvent.class);
        verify(lowStockAlertPublisher).publish(eventCaptor.capture());

        LowStockAlertEvent alert = eventCaptor.getValue();
        assertThat(alert.getProductId()).isEqualTo("P-100");
        assertThat(alert.getProductName()).isEqualTo("Wireless Mouse");
        assertThat(alert.getRemainingStock()).isEqualTo(3);
    }

    @Test
    void validateAndReserveStockDoesNotAlertWhenRemainingAboveThreshold() {
        Product product = Product.builder()
                .productID("P-200")
                .productName("Mechanical Keyboard")
                .stockQuantity(20)
                .active(true)
                .build();

        when(productRepository.findByProductIDIn(List.of("P-200")))
                .thenReturn(List.of(product));

        StockAdjustmentItemDto item = new StockAdjustmentItemDto();
        item.setProductID("P-200");
        item.setQuantity(2); // remaining will be 18 > threshold 5

        productService.validateAndReserveStock(List.of(item));

        assertThat(product.getStockQuantity()).isEqualTo(18);
        verify(productRepository).saveAll(List.of(product));
        verify(lowStockAlertPublisher, never()).publish(any());
    }
}
