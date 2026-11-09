package com.example.shop.modules.resale;

import com.example.shop.common.audit.AdminAuditLogger;
import com.example.shop.common.exception.BusinessException;
import com.example.shop.common.mail.EmailService;
import com.example.shop.common.mail.EmailTemplateService;
import com.example.shop.modules.notification.service.CustomerNotificationService;
import com.example.shop.modules.product.entity.Product;
import com.example.shop.modules.product.repository.ProductRepository;
import com.example.shop.modules.resale.dto.*;
import com.example.shop.modules.resale.entity.*;
import com.example.shop.modules.resale.repository.*;
import com.example.shop.modules.resale.service.ResaleServiceImpl;
import com.example.shop.modules.role.entity.Role;
import com.example.shop.modules.selleraccess.repository.SellerAccessRequestRepository;
import com.example.shop.modules.user.entity.User;
import com.example.shop.modules.user.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ResaleServiceTest {

    @Mock private SupplierResaleCatalogFlagRepository flagRepository;
    @Mock private SellerResaleRequestRepository requestRepository;
    @Mock private SellerResaleAuthorizationRepository authorizationRepository;
    @Mock private SellerProductListingRepository listingRepository;
    @Mock private com.example.shop.modules.resale.repository.SellerProductAllocationRepository allocationRepository;
    @Mock private org.springframework.jdbc.core.JdbcTemplate jdbcTemplate;
    @Mock private SupplierProductRepository supplierProductRepository;
    @Mock private ProductRepository productRepository;
    @Mock private UserRepository userRepository;
    @Mock private SellerAccessRequestRepository sellerAccessRequestRepository;
    @Mock private CustomerNotificationService notificationService;
    @Mock private EmailService emailService;
    @Mock private EmailTemplateService emailTemplateService;
    @Mock private AdminAuditLogger adminAuditLogger;

    @InjectMocks
    private ResaleServiceImpl resaleService;

    private User seller;
    private User supplier;
    private User otherSupplier;
    private User customer;
    private Product product;
    private SupplierResaleCatalogFlag flag;

    @BeforeEach
    void setUp() {
        seller = User.builder()
                .id(UUID.randomUUID())
                .email("seller@test.com")
                .firstName("Alice")
                .lastName("Seller")
                .roles(List.of(Role.builder().name("ROLE_SELLER").build()))
                .build();

        supplier = User.builder()
                .id(UUID.randomUUID())
                .email("supplier@test.com")
                .firstName("Bob")
                .lastName("Supplier")
                .roles(List.of(Role.builder().name("ROLE_SUPPLIER").build()))
                .build();

        otherSupplier = User.builder()
                .id(UUID.randomUUID())
                .email("other_supplier@test.com")
                .roles(List.of(Role.builder().name("ROLE_SUPPLIER").build()))
                .build();

        customer = User.builder()
                .id(UUID.randomUUID())
                .email("customer@test.com")
                .roles(List.of(Role.builder().name("ROLE_USER").build()))
                .build();

        product = Product.builder()
                .id(1L)
                .productID("PROD-100")
                .productName("Organic Coffee")
                .category("Beverages")
                .productPrice(12.99)
                .stockQuantity(100)
                .active(true)
                .supplierUserId(supplier.getId())
                .build();

        flag = SupplierResaleCatalogFlag.builder()
                .id(1L)
                .productId("PROD-100")
                .supplierUserId(supplier.getId())
                .resaleEnabled(true)
                .supplierProductApproved(true)
                .wholesalePrice(BigDecimal.valueOf(9.50))
                .minimumOrderQuantity(1)
                .commercialNote("20% wholesale discount on order")
                .build();
    }

    // ==========================================
    // Phase 1: Supplier Catalog Flag Tests
    // ==========================================

    @Test
    @DisplayName("Supplier can enable resale discovery for their own product")
    void testSetResaleFlag_Success() {
        when(productRepository.findByProductID("PROD-100")).thenReturn(Optional.of(product));
        when(flagRepository.findByProductId("PROD-100")).thenReturn(Optional.of(flag));
        when(flagRepository.save(any(SupplierResaleCatalogFlag.class))).thenReturn(flag);
        when(supplierProductRepository.findBySupplierIdAndProductProductID(supplier.getId(), "PROD-100")).thenReturn(Optional.empty());

        SupplierResaleCatalogFlagDto result = resaleService.setResaleTerms("PROD-100", true, "Special terms", BigDecimal.valueOf(9.50), 2, supplier);

        assertThat(result).isNotNull();
        assertThat(result.getResaleEnabled()).isTrue();
        verify(adminAuditLogger).log(eq("RESALE_FLAG_UPDATED"), eq(supplier.getEmail()), anyMap());
    }

    @Test
    @DisplayName("Supplier cannot manage resale flag for another supplier's product")
    void testSetResaleFlag_ForbiddenForOtherSupplier() {
        when(productRepository.findByProductID("PROD-100")).thenReturn(Optional.of(product));

        assertThatThrownBy(() -> resaleService.setResaleFlag("PROD-100", true, "terms", otherSupplier))
                .isInstanceOf(BusinessException.class)
                .hasFieldOrPropertyWithValue("status", HttpStatus.FORBIDDEN);
    }

    // ==========================================
    // Phase 2: Seller Resale Request Submission
    // ==========================================

    @Test
    @DisplayName("Seller can submit a resale request for an eligible supplier product")
    void testSubmitRequest_Success() {
        SubmitResaleRequestDto dto = SubmitResaleRequestDto.builder()
                .supplierProductId("PROD-100")
                .proposalMessage("I want to feature this in my gourmet shop")
                .proposedRetailPrice(BigDecimal.valueOf(15.99))
                .build();

        when(productRepository.findByProductID("PROD-100")).thenReturn(Optional.of(product));
        when(flagRepository.findByProductId("PROD-100")).thenReturn(Optional.of(flag));
        when(requestRepository.existsBySellerIdAndSupplierProductIdAndStatus(seller.getId(), "PROD-100", SellerResaleRequestStatus.PENDING))
                .thenReturn(false);
        when(authorizationRepository.existsBySellerIdAndSupplierProductIdAndActiveTrue(seller.getId(), "PROD-100"))
                .thenReturn(false);
        when(userRepository.findById(seller.getId())).thenReturn(Optional.of(seller));

        SellerResaleRequest savedRequest = SellerResaleRequest.builder()
                .id(UUID.randomUUID())
                .supplierProductId("PROD-100")
                .seller(seller)
                .supplierUserId(supplier.getId())
                .proposalMessage(dto.getProposalMessage())
                .proposedRetailPrice(dto.getProposedRetailPrice())
                .status(SellerResaleRequestStatus.PENDING)
                .createdAt(LocalDateTime.now())
                .build();

        when(requestRepository.save(any(SellerResaleRequest.class))).thenReturn(savedRequest);

        ResaleRequestResponseDto response = resaleService.submitRequest(dto, seller);

        assertThat(response).isNotNull();
        assertThat(response.getStatus()).isEqualTo("PENDING");
        assertThat(response.getSupplierProductId()).isEqualTo("PROD-100");
        verify(notificationService).createForUser(eq(supplier.getId()), anyString(), eq("resale"), anyString(), anyString(), anyString(), anyString());
        verify(notificationService).notifyAdmins(anyString(), eq("resale"), anyString(), anyString(), anyString(), anyString());
    }

    @Test
    @DisplayName("Prevents duplicate pending request for same seller and supplier product")
    void testSubmitRequest_DuplicatePendingThrowsConflict() {
        SubmitResaleRequestDto dto = SubmitResaleRequestDto.builder()
                .supplierProductId("PROD-100")
                .build();

        when(productRepository.findByProductID("PROD-100")).thenReturn(Optional.of(product));
        when(flagRepository.findByProductId("PROD-100")).thenReturn(Optional.of(flag));
        when(requestRepository.existsBySellerIdAndSupplierProductIdAndStatus(seller.getId(), "PROD-100", SellerResaleRequestStatus.PENDING))
                .thenReturn(true);

        assertThatThrownBy(() -> resaleService.submitRequest(dto, seller))
                .isInstanceOf(BusinessException.class)
                .hasFieldOrPropertyWithValue("status", HttpStatus.CONFLICT)
                .hasMessageContaining("already have a pending request");
    }

    @Test
    @DisplayName("Prevents request when seller already has an active authorization")
    void testSubmitRequest_AlreadyAuthorizedThrowsConflict() {
        SubmitResaleRequestDto dto = SubmitResaleRequestDto.builder()
                .supplierProductId("PROD-100")
                .build();

        when(productRepository.findByProductID("PROD-100")).thenReturn(Optional.of(product));
        when(flagRepository.findByProductId("PROD-100")).thenReturn(Optional.of(flag));
        when(requestRepository.existsBySellerIdAndSupplierProductIdAndStatus(seller.getId(), "PROD-100", SellerResaleRequestStatus.PENDING))
                .thenReturn(false);
        when(authorizationRepository.existsBySellerIdAndSupplierProductIdAndActiveTrue(seller.getId(), "PROD-100"))
                .thenReturn(true);

        assertThatThrownBy(() -> resaleService.submitRequest(dto, seller))
                .isInstanceOf(BusinessException.class)
                .hasFieldOrPropertyWithValue("status", HttpStatus.CONFLICT)
                .hasMessageContaining("active resale authorization");
    }

    @Test
    @DisplayName("Throws error when non-seller attempts to submit resale request")
    void testSubmitRequest_NonSellerThrowsForbidden() {
        SubmitResaleRequestDto dto = SubmitResaleRequestDto.builder()
                .supplierProductId("PROD-100")
                .build();

        assertThatThrownBy(() -> resaleService.submitRequest(dto, customer))
                .isInstanceOf(BusinessException.class)
                .hasFieldOrPropertyWithValue("status", HttpStatus.FORBIDDEN);
    }

    // ==========================================
    // Phase 3: Supplier Review (Accept / Reject)
    // ==========================================

    @Test
    @DisplayName("Supplier accepts request, records reviewer note, and establishes persistent authorization")
    void testAcceptRequest_Success() {
        UUID reqId = UUID.randomUUID();
        SellerResaleRequest pendingReq = SellerResaleRequest.builder()
                .id(reqId)
                .supplierProductId("PROD-100")
                .seller(seller)
                .supplierUserId(supplier.getId())
                .status(SellerResaleRequestStatus.PENDING)
                .build();

        when(requestRepository.findById(reqId)).thenReturn(Optional.of(pendingReq));
        when(userRepository.findById(supplier.getId())).thenReturn(Optional.of(supplier));
        when(requestRepository.save(any(SellerResaleRequest.class))).thenAnswer(i -> i.getArgument(0));
        when(productRepository.findByProductID("PROD-100")).thenReturn(Optional.of(product));

        ResaleRequestResponseDto result = resaleService.acceptRequest(reqId, "Welcome aboard!", supplier);

        assertThat(result.getStatus()).isEqualTo("APPROVED");
        assertThat(result.getReviewerNote()).isEqualTo("Welcome aboard!");
        verify(authorizationRepository).save(argThat(auth ->
                auth.getActive() && auth.getSupplierProductId().equals("PROD-100") && auth.getSeller().equals(seller)
        ));
        verify(notificationService).createForUser(eq(seller.getId()), anyString(), eq("resale"), anyString(), anyString(), anyString(), anyString());
    }

    @Test
    @DisplayName("Supplier cannot accept request owned by a different supplier")
    void testAcceptRequest_WrongSupplierForbidden() {
        UUID reqId = UUID.randomUUID();
        SellerResaleRequest pendingReq = SellerResaleRequest.builder()
                .id(reqId)
                .supplierProductId("PROD-100")
                .seller(seller)
                .supplierUserId(supplier.getId())
                .status(SellerResaleRequestStatus.PENDING)
                .build();

        when(requestRepository.findById(reqId)).thenReturn(Optional.of(pendingReq));

        assertThatThrownBy(() -> resaleService.acceptRequest(reqId, "note", otherSupplier))
                .isInstanceOf(BusinessException.class)
                .hasFieldOrPropertyWithValue("status", HttpStatus.FORBIDDEN);
    }

    @Test
    @DisplayName("Supplier rejects request with mandatory reason")
    void testRejectRequest_Success() {
        UUID reqId = UUID.randomUUID();
        SellerResaleRequest pendingReq = SellerResaleRequest.builder()
                .id(reqId)
                .supplierProductId("PROD-100")
                .seller(seller)
                .supplierUserId(supplier.getId())
                .status(SellerResaleRequestStatus.PENDING)
                .build();

        when(requestRepository.findById(reqId)).thenReturn(Optional.of(pendingReq));
        when(userRepository.findById(supplier.getId())).thenReturn(Optional.of(supplier));
        when(requestRepository.save(any(SellerResaleRequest.class))).thenAnswer(i -> i.getArgument(0));
        when(productRepository.findByProductID("PROD-100")).thenReturn(Optional.of(product));

        ResaleRequestResponseDto result = resaleService.rejectRequest(reqId, "Exclusive territory agreement", supplier);

        assertThat(result.getStatus()).isEqualTo("REJECTED");
        assertThat(result.getReviewerNote()).isEqualTo("Exclusive territory agreement");
        verify(notificationService).createForUser(eq(seller.getId()), anyString(), eq("resale"), anyString(), anyString(), anyString(), anyString());
    }

    @Test
    @DisplayName("Supplier rejecting request without reason throws BAD_REQUEST")
    void testRejectRequest_MissingReasonThrowsBadRequest() {
        UUID reqId = UUID.randomUUID();

        assertThatThrownBy(() -> resaleService.rejectRequest(reqId, "   ", supplier))
                .isInstanceOf(BusinessException.class)
                .hasFieldOrPropertyWithValue("status", HttpStatus.BAD_REQUEST)
                .hasMessageContaining("rejection reason is required");
    }

    // ==========================================
    // Phase 4: Revocation & Listing Model Isolation
    // ==========================================

    @Test
    @DisplayName("Revoking authorization deactivates seller listings safely with preserved audit trail")
    void testRevokeAuthorization_Success() {
        UUID authId = UUID.randomUUID();
        SellerResaleAuthorization auth = SellerResaleAuthorization.builder()
                .id(authId)
                .supplierProductId("PROD-100")
                .seller(seller)
                .supplierUserId(supplier.getId())
                .active(true)
                .build();

        SellerProductListing listing = SellerProductListing.builder()
                .id(UUID.randomUUID())
                .authorization(auth)
                .supplierProductId("PROD-100")
                .seller(seller)
                .supplierUserId(supplier.getId())
                .active(true)
                .build();

        when(authorizationRepository.findById(authId)).thenReturn(Optional.of(auth));
        when(userRepository.findById(supplier.getId())).thenReturn(Optional.of(supplier));
        when(listingRepository.findByAuthorizationIdOrderByCreatedAtDesc(eq(authId), any()))
                .thenReturn(new PageImpl<>(List.of(listing)));
        when(authorizationRepository.save(any())).thenAnswer(i -> i.getArgument(0));
        when(productRepository.findByProductID("PROD-100")).thenReturn(Optional.of(product));

        ResaleAuthorizationDto result = resaleService.revokeAuthorization(authId, "Breach of MAP policy", supplier);

        assertThat(result.getActive()).isFalse();
        assertThat(listing.getActive()).isFalse();
        verify(listingRepository).save(listing);
        verify(notificationService).createForUser(eq(seller.getId()), anyString(), eq("resale"), anyString(), anyString(), anyString(), anyString());
    }

    @Test
    @DisplayName("Seller cannot create listing without active authorization")
    void testCreateListing_InactiveAuthThrowsBadRequest() {
        UUID authId = UUID.randomUUID();
        SellerResaleAuthorization inactiveAuth = SellerResaleAuthorization.builder()
                .id(authId)
                .supplierProductId("PROD-100")
                .seller(seller)
                .supplierUserId(supplier.getId())
                .active(false)
                .build();

        when(authorizationRepository.findById(authId)).thenReturn(Optional.of(inactiveAuth));

        CreateListingDto dto = CreateListingDto.builder()
                .authorizationId(authId.toString())
                .retailPrice(BigDecimal.valueOf(19.99))
                .build();

        assertThatThrownBy(() -> resaleService.createListing(dto, seller))
                .isInstanceOf(BusinessException.class)
                .hasFieldOrPropertyWithValue("status", HttpStatus.BAD_REQUEST)
                .hasMessageContaining("not active");
    }

    @Test
    @DisplayName("Seller creates listing with supplier offer and retail price equal to base price successfully")
    void testCreateListing_WithSupplierOffer_FlushesAndCreatesAllocationAudit() {
        UUID authId = UUID.randomUUID();
        UUID offerId = UUID.randomUUID();
        SupplierProduct offer = SupplierProduct.builder()
                .id(offerId)
                .product(product)
                .supplier(supplier)
                .wholesalePrice(BigDecimal.valueOf(60.00))
                .stockQuantity(20)
                .reservedQuantity(0)
                .minimumOrderQuantity(1)
                .approved(true)
                .available(true)
                .allowResale(true)
                .build();

        SellerResaleAuthorization auth = SellerResaleAuthorization.builder()
                .id(authId)
                .supplierProductId("PROD-100")
                .supplierOffer(offer)
                .seller(seller)
                .supplierUserId(supplier.getId())
                .initialAllocationQuantity(10)
                .active(true)
                .build();

        when(authorizationRepository.findById(authId)).thenReturn(Optional.of(auth));
        when(productRepository.findByProductID("PROD-100")).thenReturn(Optional.of(product));
        when(supplierProductRepository.findDetailedById(offerId)).thenReturn(Optional.of(offer));
        when(listingRepository.existsBySellerIdAndSupplierOfferId(seller.getId(), offerId)).thenReturn(false);
        when(userRepository.findById(seller.getId())).thenReturn(Optional.of(seller));
        when(userRepository.findById(supplier.getId())).thenReturn(Optional.of(supplier));

        UUID listingId = UUID.randomUUID();
        when(listingRepository.saveAndFlush(any(SellerProductListing.class))).thenAnswer(inv -> {
            SellerProductListing l = inv.getArgument(0);
            l.setId(listingId);
            return l;
        });

        when(jdbcTemplate.queryForObject(contains("stock_quantity-reserved_quantity"), eq(Integer.class), eq(offerId)))
                .thenReturn(20);
        when(allocationRepository.sumRemainingForOffer(offerId)).thenReturn(0L);
        when(authorizationRepository.sumUnlistedApprovedAllocationsForOfferExcluding(eq(supplier.getId()), eq(offerId), eq(authId)))
                .thenReturn(0L);

        UUID allocationId = UUID.randomUUID();
        when(allocationRepository.saveAndFlush(any(SellerProductAllocation.class))).thenAnswer(inv -> {
            SellerProductAllocation a = inv.getArgument(0);
            a.setId(allocationId);
            return a;
        });
        when(allocationRepository.findByListingId(listingId)).thenReturn(Optional.of(
                SellerProductAllocation.builder()
                        .id(allocationId)
                        .allocatedQuantity(10)
                        .soldQuantity(0)
                        .reservedQuantity(0)
                        .status("ACTIVE")
                        .build()
        ));

        CreateListingDto dto = CreateListingDto.builder()
                .authorizationId(authId.toString())
                .retailPrice(BigDecimal.valueOf(60.00))
                .customTitle("Normal Jacket")
                .build();

        SellerProductListingDto result = resaleService.createListing(dto, seller);

        assertThat(result).isNotNull();
        assertThat(result.getId()).isEqualTo(listingId);
        assertThat(result.getRetailPrice()).isEqualByComparingTo("60.00");
        assertThat(result.getCustomTitle()).isEqualTo("Normal Jacket");
        assertThat(result.getAllocatedQuantity()).isEqualTo(10);

        verify(listingRepository).saveAndFlush(any(SellerProductListing.class));
        verify(allocationRepository).saveAndFlush(any(SellerProductAllocation.class));
        verify(jdbcTemplate).update(contains("seller_product_allocation_audit"), eq(allocationId), eq(0), eq(10), eq(supplier.getId()), anyString());
    }

    @Test
    @DisplayName("Duplicate listing creation returns CONFLICT")
    void testCreateListing_DuplicateSubmission_ThrowsConflict() {
        UUID authId = UUID.randomUUID();
        UUID offerId = UUID.randomUUID();
        SupplierProduct offer = SupplierProduct.builder()
                .id(offerId)
                .product(product)
                .supplier(supplier)
                .wholesalePrice(BigDecimal.valueOf(60.00))
                .stockQuantity(20)
                .reservedQuantity(0)
                .minimumOrderQuantity(1)
                .approved(true)
                .available(true)
                .allowResale(true)
                .build();

        SellerResaleAuthorization auth = SellerResaleAuthorization.builder()
                .id(authId)
                .supplierProductId("PROD-100")
                .supplierOffer(offer)
                .seller(seller)
                .supplierUserId(supplier.getId())
                .active(true)
                .build();

        when(authorizationRepository.findById(authId)).thenReturn(Optional.of(auth));
        when(productRepository.findByProductID("PROD-100")).thenReturn(Optional.of(product));
        when(supplierProductRepository.findDetailedById(offerId)).thenReturn(Optional.of(offer));
        when(listingRepository.existsBySellerIdAndSupplierOfferId(seller.getId(), offerId)).thenReturn(true);

        CreateListingDto dto = CreateListingDto.builder()
                .authorizationId(authId.toString())
                .retailPrice(BigDecimal.valueOf(60.00))
                .build();

        assertThatThrownBy(() -> resaleService.createListing(dto, seller))
                .isInstanceOf(BusinessException.class)
                .hasFieldOrPropertyWithValue("status", HttpStatus.CONFLICT)
                .hasMessageContaining("already have a listing");
    }

    // ==========================================
    // Phase 5: Seller Profile Inspection
    // ==========================================

    @Test
    @DisplayName("Supplier can inspect Seller public profile and partnership history")
    void testGetSellerProfileForSupplier_Success() {
        when(userRepository.findById(seller.getId())).thenReturn(Optional.of(seller));
        when(sellerAccessRequestRepository.findFirstByRequestedByIdOrderByCreatedAtDesc(seller.getId()))
                .thenReturn(Optional.empty());
        when(productRepository.findBySellerUserIdOrderByIdAsc(seller.getId())).thenReturn(List.of());
        when(authorizationRepository.findBySellerIdOrderByGrantedAtDesc(eq(seller.getId()), any()))
                .thenReturn(new PageImpl<>(List.of()));
        when(requestRepository.findBySellerIdOrderByCreatedAtDesc(eq(seller.getId()), any()))
                .thenReturn(new PageImpl<>(List.of()));

        SellerProfileDto profile = resaleService.getSellerProfileForSupplier(seller.getId(), supplier);

        assertThat(profile).isNotNull();
        assertThat(profile.getSellerId()).isEqualTo(seller.getId());
        assertThat(profile.getStoreName()).contains("Alice");
    }

    // ==========================================
    // Phase 6: Supplier Resale Permission System
    // ==========================================

    @Test
    @DisplayName("Submit resale request is rejected when allowResale is disabled")
    void testSubmitRequest_RejectedWhenAllowResaleDisabled() {
        UUID offerId = UUID.randomUUID();
        SupplierProduct offer = SupplierProduct.builder()
                .id(offerId)
                .product(product)
                .supplier(supplier)
                .wholesalePrice(BigDecimal.valueOf(10.0))
                .stockQuantity(100)
                .reservedQuantity(0)
                .minimumOrderQuantity(5)
                .approved(true)
                .available(false)
                .allowResale(false)
                .build();

        when(supplierProductRepository.findDetailedById(offerId)).thenReturn(Optional.of(offer));

        SubmitResaleRequestDto dto = SubmitResaleRequestDto.builder()
                .supplierProductId(offerId.toString())
                .proposalMessage("I want to resell")
                .proposedRetailPrice(BigDecimal.valueOf(15.0))
                .build();

        assertThatThrownBy(() -> resaleService.submitRequest(dto, seller))
                .isInstanceOf(BusinessException.class)
                .hasFieldOrPropertyWithValue("status", HttpStatus.BAD_REQUEST)
                .hasMessageContaining("not available for resale");
    }

    @Test
    @DisplayName("Cross-supplier catalog terms edit is rejected with FORBIDDEN")
    void testSetResaleTerms_CrossSupplierRejectedWithForbidden() {
        product.setSupplierUserId(otherSupplier.getId());
        when(productRepository.findByProductID("PROD-100")).thenReturn(Optional.of(product));

        assertThatThrownBy(() -> resaleService.setResaleTerms("PROD-100", true, "terms", BigDecimal.valueOf(10), 1, supplier))
                .isInstanceOf(BusinessException.class)
                .hasFieldOrPropertyWithValue("status", HttpStatus.FORBIDDEN);
    }

    @Test
    @DisplayName("Cross-seller listing update is rejected with FORBIDDEN")
    void testUpdateListing_CrossSellerRejectedWithForbidden() {
        UUID listingId = UUID.randomUUID();
        User anotherSeller = User.builder().id(UUID.randomUUID()).roles(List.of(com.example.shop.modules.role.entity.Role.builder().name("ROLE_SELLER").build())).build();
        SellerProductListing listing = SellerProductListing.builder()
                .id(listingId)
                .seller(anotherSeller)
                .supplierUserId(supplier.getId())
                .retailPrice(BigDecimal.valueOf(20.0))
                .active(true)
                .build();

        when(listingRepository.findById(listingId)).thenReturn(Optional.of(listing));

        UpdateListingDto dto = UpdateListingDto.builder()
                .retailPrice(BigDecimal.valueOf(25.0))
                .active(false)
                .build();

        assertThatThrownBy(() -> resaleService.updateListing(listingId, dto, seller))
                .isInstanceOf(BusinessException.class)
                .hasFieldOrPropertyWithValue("status", HttpStatus.FORBIDDEN);
    }

    @Test
    @DisplayName("Seller listing update changes only the Seller listing")
    void testUpdateListing_UpdatesOwnedListingWithoutChangingSupplierProduct() {
        UUID listingId = UUID.randomUUID();
        Double sourcePrice = product.getProductPrice();
        Integer sourceStock = product.getStockQuantity();
        SellerProductListing listing = SellerProductListing.builder()
                .id(listingId)
                .seller(seller)
                .supplierUserId(supplier.getId())
                .supplierProductId(product.getProductID())
                .retailPrice(BigDecimal.valueOf(20.0))
                .active(true)
                .build();
        when(listingRepository.findById(listingId)).thenReturn(Optional.of(listing));
        when(listingRepository.save(listing)).thenReturn(listing);
        when(productRepository.findByProductID(product.getProductID())).thenReturn(Optional.of(product));
        when(userRepository.findById(supplier.getId())).thenReturn(Optional.of(supplier));

        SellerProductListingDto updated = resaleService.updateListing(listingId,
                UpdateListingDto.builder().retailPrice(BigDecimal.valueOf(27.50)).active(false).build(), seller);

        assertThat(updated.getId()).isEqualTo(listingId);
        assertThat(updated.getRetailPrice()).isEqualByComparingTo("27.50");
        assertThat(listing.getActive()).isFalse();
        assertThat(product.getProductPrice()).isEqualTo(sourcePrice);
        assertThat(product.getStockQuantity()).isEqualTo(sourceStock);
        verify(productRepository, never()).save(any(Product.class));
    }
}
