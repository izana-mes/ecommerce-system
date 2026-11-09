package com.example.shop.modules.product.service;

import com.example.shop.common.exception.BusinessException;
import com.example.shop.config.CacheInvalidationEventPublisher;
import com.example.shop.modules.cart.repository.CartItemRepository;
import com.example.shop.modules.messaging.inventory.LowStockAlertEvent;
import com.example.shop.modules.messaging.inventory.LowStockAlertPublisher;
import com.example.shop.modules.product.dto.ProductDto;
import com.example.shop.modules.product.dto.ProductSuggestionDto;
import com.example.shop.modules.product.dto.StockAdjustmentItemDto;
import com.example.shop.modules.product.entity.Product;
import com.example.shop.modules.product.mapper.ProductMapper;
import com.example.shop.modules.product.repository.ProductRepository;
import com.example.shop.modules.role.entity.Role;
import com.example.shop.modules.user.entity.User;
import com.example.shop.modules.user.repository.UserRepository;
import com.example.shop.modules.resale.repository.SupplierProductRepository;
import com.example.shop.modules.resale.repository.SellerProductListingRepository;
import com.example.shop.modules.resale.entity.SellerProductListing;
import com.example.shop.modules.resale.entity.SupplierProduct;
import com.example.shop.modules.user.entity.SupplierOperatingMode;
import com.example.shop.modules.resale.service.SellerListingCatalog;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.*;

class ProductServiceImplTest {

    private ProductRepository productRepository;
    private ProductMapper productMapper;
    private CartItemRepository cartItemRepository;
    private CacheInvalidationEventPublisher cacheInvalidationEventPublisher;
    private LowStockAlertPublisher lowStockAlertPublisher;
    private UserRepository userRepository;
    private SupplierProductRepository supplierProductRepository;
    private SellerProductListingRepository sellerListings;
    private SellerListingCatalog sellerListingCatalog;
    private JdbcTemplate jdbcTemplate;
    private ProductServiceImpl productService;

    @BeforeEach
    void setUp() {
        productRepository = mock(ProductRepository.class);
        productMapper = mock(ProductMapper.class);
        cartItemRepository = mock(CartItemRepository.class);
        cacheInvalidationEventPublisher = mock(CacheInvalidationEventPublisher.class);
        lowStockAlertPublisher = mock(LowStockAlertPublisher.class);
        userRepository = mock(UserRepository.class);
        supplierProductRepository = mock(SupplierProductRepository.class);
        sellerListings = mock(SellerProductListingRepository.class);
        sellerListingCatalog = mock(SellerListingCatalog.class);
        jdbcTemplate = mock(JdbcTemplate.class);
        when(productRepository.findAllByOrderByIdAsc()).thenReturn(List.of());
        when(sellerListings.findByActiveTrueOrderByCreatedAtDesc()).thenReturn(List.of());
        when(supplierProductRepository.findEligibleDirectRetailOffers()).thenReturn(List.of());

        productService = new ProductServiceImpl(
                productRepository,
                productMapper,
                cartItemRepository,
                cacheInvalidationEventPublisher,
                lowStockAlertPublisher,
                userRepository,
                supplierProductRepository,
                sellerListings,
                sellerListingCatalog,
                jdbcTemplate
        );
        ReflectionTestUtils.setField(productService, "lowStockThreshold", 5);
    }

    @Test
    void searchSuggestionsIncludeSellerListingWithCatalogIdentifierAndCaseInsensitivePartialMatch() {
        UUID listingId = UUID.randomUUID();
        SellerProductListing listing = mock(SellerProductListing.class);
        when(listing.getId()).thenReturn(listingId);
        when(sellerListings.findByActiveTrueOrderByCreatedAtDesc()).thenReturn(List.of(listing));
        when(sellerListingCatalog.resolve("LISTING:" + listingId)).thenReturn(listing);
        Product listingProduct = Product.builder().productID("LISTING:" + listingId)
                .productName("Cold Jacket").productPrice(62.0).active(true).stockQuantity(12).build();
        when(sellerListingCatalog.retailProduct(listing, "LISTING:" + listingId)).thenReturn(listingProduct);
        when(productMapper.toDto(listingProduct)).thenReturn(toDto(listingProduct));

        List<ProductSuggestionDto> suggestions = productService.searchSuggestions("cOlD ja", 8);

        assertThat(suggestions).hasSize(1);
        assertThat(suggestions.get(0).getProductID()).isEqualTo("LISTING:" + listingId);
        assertThat(suggestions.get(0).getProductName()).isEqualTo("Cold Jacket");
        assertThat(suggestions.get(0).getProductPrice()).isEqualTo(62.0);
        verify(productRepository, never()).findByProductID(anyString());
    }

    @Test
    void searchProductsIncludesActiveAdminProductsAndMatchesCaseInsensitively() {
        Product product = Product.builder().productID("ADMIN-1").productName("Blue Wool Coat")
                .category("Jackets").active(true).build();
        when(productRepository.findAllByOrderByIdAsc()).thenReturn(List.of(product, product));
        when(productMapper.toDto(product)).thenReturn(toDto(product));

        List<ProductDto> found = productService.searchProducts("BLUE wool");
        List<ProductSuggestionDto> suggestions = productService.searchSuggestions("BLUE wool", 8);

        assertThat(found).extracting(ProductDto::getProductID).containsExactly("ADMIN-1");
        assertThat(suggestions).extracting(ProductSuggestionDto::getProductID).containsExactly("ADMIN-1");
    }

    @Test
    void searchSuggestionsIncludeEligibleSupplierDirectRetailOffer() {
        UUID offerId = UUID.randomUUID();
        SupplierProduct offer = mock(SupplierProduct.class);
        User supplier = mock(User.class);
        when(offer.getId()).thenReturn(offerId);
        when(offer.getSupplier()).thenReturn(supplier);
        when(supplier.getSupplierOperatingMode()).thenReturn(SupplierOperatingMode.SUPPLY_AND_SELL);
        when(supplierProductRepository.findEligibleDirectRetailOffers()).thenReturn(List.of(offer));
        Product supplierProduct = Product.builder().productID("SUPPLIER:" + offerId)
                .productName("Needlepoint Scarf").productPrice(31.5).active(true).build();
        when(sellerListingCatalog.directRetailProduct(offer, "SUPPLIER:" + offerId)).thenReturn(supplierProduct);
        when(productMapper.toDto(supplierProduct)).thenReturn(toDto(supplierProduct));

        List<ProductSuggestionDto> suggestions = productService.searchSuggestions("NEEDLE", 8);

        assertThat(suggestions).hasSize(1);
        assertThat(suggestions.get(0).getProductID()).isEqualTo("SUPPLIER:" + offerId);
        assertThat(suggestions.get(0).getProductPrice()).isEqualTo(31.5);
    }

    @Test
    void regularProductUpdateRejectsListingCatalogKeyWithoutQueryingProductRepository() {
        assertThatThrownBy(() -> productService.updateProduct("LISTING:" + UUID.randomUUID(), new ProductDto()))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("must be updated through their owning Seller or Supplier endpoint");
        verify(productRepository, never()).findByProductID(anyString());
    }

    private ProductDto toDto(Product product) {
        ProductDto dto = new ProductDto();
        dto.setProductID(product.getProductID());
        dto.setProductName(product.getProductName());
        dto.setProductPrice(product.getProductPrice());
        dto.setCategory(product.getCategory());
        dto.setActive(product.getActive());
        dto.setStockQuantity(product.getStockQuantity());
        return dto;
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

    // ── Public Visibility & Detail Lookup (getProductForViewer) ────────────────

    @Test
    void getProductForViewer_allowsPublicAccessToActiveProduct() {
        Product product = Product.builder()
                .productID("P-ACTIVE")
                .productName("Active Shoe")
                .active(true)
                .build();
        ProductDto dto = new ProductDto();
        dto.setProductID("P-ACTIVE");

        when(productRepository.findByProductID("P-ACTIVE")).thenReturn(Optional.of(product));
        when(productMapper.toDto(product)).thenReturn(dto);

        ProductDto result = productService.getProductForViewer("P-ACTIVE", null);
        assertThat(result.getProductID()).isEqualTo("P-ACTIVE");
    }

    @Test
    void getProductForViewer_blocksPublicAccessToInactiveProduct() {
        Product product = Product.builder()
                .productID("P-INACTIVE")
                .productName("Draft Shoe")
                .active(false)
                .build();

        when(productRepository.findByProductID("P-INACTIVE")).thenReturn(Optional.of(product));

        assertThatThrownBy(() -> productService.getProductForViewer("P-INACTIVE", null))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("not found");
    }

    @Test
    void getProductForViewer_blocksCustomerFromInactiveProduct() {
        Product product = Product.builder()
                .productID("P-INACTIVE")
                .active(false)
                .build();
        User customer = User.builder()
                .id(UUID.randomUUID())
                .roles(List.of(Role.builder().name("ROLE_USER").build()))
                .build();

        when(productRepository.findByProductID("P-INACTIVE")).thenReturn(Optional.of(product));

        assertThatThrownBy(() -> productService.getProductForViewer("P-INACTIVE", customer))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("not found");
    }

    @Test
    void getProductForViewer_allowsAdminAccessToInactiveProduct() {
        Product product = Product.builder()
                .productID("P-INACTIVE")
                .active(false)
                .build();
        User admin = User.builder()
                .id(UUID.randomUUID())
                .roles(List.of(Role.builder().name("ROLE_ADMIN").build()))
                .build();
        ProductDto dto = new ProductDto();
        dto.setProductID("P-INACTIVE");

        when(productRepository.findByProductID("P-INACTIVE")).thenReturn(Optional.of(product));
        when(productMapper.toDto(product)).thenReturn(dto);

        ProductDto result = productService.getProductForViewer("P-INACTIVE", admin);
        assertThat(result.getProductID()).isEqualTo("P-INACTIVE");
    }

    @Test
    void getProductForViewer_allowsOwningSellerAccessToInactiveProduct() {
        UUID sellerId = UUID.randomUUID();
        Product product = Product.builder()
                .productID("P-SELLER-INACTIVE")
                .active(false)
                .sellerUserId(sellerId)
                .build();
        User seller = User.builder()
                .id(sellerId)
                .roles(List.of(Role.builder().name("ROLE_SELLER").build()))
                .build();
        ProductDto dto = new ProductDto();
        dto.setProductID("P-SELLER-INACTIVE");

        when(productRepository.findByProductID("P-SELLER-INACTIVE")).thenReturn(Optional.of(product));
        when(productMapper.toDto(product)).thenReturn(dto);

        ProductDto result = productService.getProductForViewer("P-SELLER-INACTIVE", seller);
        assertThat(result.getProductID()).isEqualTo("P-SELLER-INACTIVE");
    }

    @Test
    void getProductForViewer_blocksNonOwningSellerFromInactiveProduct() {
        UUID sellerA = UUID.randomUUID();
        UUID sellerB = UUID.randomUUID();
        Product product = Product.builder()
                .productID("P-SELLER-INACTIVE")
                .active(false)
                .sellerUserId(sellerA)
                .build();
        User otherSeller = User.builder()
                .id(sellerB)
                .roles(List.of(Role.builder().name("ROLE_SELLER").build()))
                .build();

        when(productRepository.findByProductID("P-SELLER-INACTIVE")).thenReturn(Optional.of(product));

        assertThatThrownBy(() -> productService.getProductForViewer("P-SELLER-INACTIVE", otherSeller))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("not found");
    }

    // ── deleteProduct ──────────────────────────────────────────────────────────

    @Test
    void deleteProduct_whenProductNotFound_returnsGracefully() {
        when(productRepository.findByProductID("P-NOT-FOUND")).thenReturn(Optional.empty());

        productService.deleteProduct("P-NOT-FOUND");

        verify(productRepository, never()).delete(any());
        verify(productRepository, never()).save(any());
    }

    @Test
    void deleteProduct_whenCommercialReferencesExist_softDeletesAndDeactivatesLinkedRecords() {
        Product product = Product.builder()
                .productID("14")
                .productName("Cold Jacket")
                .active(true)
                .build();
        when(productRepository.findByProductID("14")).thenReturn(Optional.of(product));
        when(jdbcTemplate.queryForObject(contains("seller_resale_authorizations"), eq(Integer.class), eq("14")))
                .thenReturn(1);
        when(jdbcTemplate.queryForObject(contains("seller_product_listings"), eq(Integer.class), eq("14")))
                .thenReturn(1);
        when(jdbcTemplate.queryForObject(contains("supplier_products"), eq(Integer.class), eq("14")))
                .thenReturn(1);
        when(jdbcTemplate.queryForObject(contains("order_items"), eq(Integer.class), eq("14")))
                .thenReturn(0);

        productService.deleteProduct("14");

        assertThat(product.getActive()).isFalse();
        verify(productRepository).save(product);
        verify(productRepository, never()).delete(any());
        verify(jdbcTemplate, atLeastOnce()).update(contains("seller_product_listings"), eq("14"));
        verify(jdbcTemplate, atLeastOnce()).update(contains("supplier_products"), eq("14"));
        verify(jdbcTemplate, atLeastOnce()).update(contains("seller_resale_authorizations"), eq("14"));
    }

    @Test
    void deleteProduct_whenNoCommercialReferencesExist_hardDeletes() {
        Product product = Product.builder()
                .productID("P-ORPHAN")
                .productName("Unused Product")
                .active(true)
                .build();
        when(productRepository.findByProductID("P-ORPHAN")).thenReturn(Optional.of(product));
        when(jdbcTemplate.queryForObject(anyString(), eq(Integer.class), eq("P-ORPHAN")))
                .thenReturn(0);

        productService.deleteProduct("P-ORPHAN");

        verify(productRepository).delete(product);
        verify(productRepository, never()).save(any());
    }
}
