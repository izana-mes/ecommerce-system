package com.example.shop.modules.productapproval;

import com.example.shop.common.exception.BusinessException;
import com.example.shop.modules.product.entity.Product;
import com.example.shop.modules.product.repository.ProductRepository;
import com.example.shop.modules.productapproval.entity.ProductChangeAction;
import com.example.shop.modules.productapproval.entity.ProductChangeRequest;
import com.example.shop.modules.productapproval.entity.ProductChangeRequestStatus;
import com.example.shop.modules.productapproval.repository.ProductChangeRequestRepository;
import com.example.shop.modules.productapproval.service.ProductChangeRequestService;
import com.example.shop.modules.product.service.ProductService;
import com.example.shop.modules.role.entity.Role;
import com.example.shop.modules.user.entity.User;
import com.example.shop.modules.user.repository.UserRepository;
import com.example.shop.common.audit.AdminAuditLogger;
import com.example.shop.common.mail.EmailService;
import com.example.shop.common.mail.EmailTemplateService;
import com.example.shop.modules.notification.service.CustomerNotificationService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

/**
 * Unit tests verifying moderation security rules:
 * - Only the original requester can resubmit
 * - requestChanges requires a non-blank reviewer note
 * - Ownership validation blocks cross-seller/supplier modifications
 * - CHANGES_REQUESTED → PENDING resubmission lifecycle
 */
class ProductModerationSecurityTest {

    private ProductChangeRequestRepository requestRepository;
    private UserRepository userRepository;
    private ProductRepository productRepository;
    private ProductService productService;
    private AdminAuditLogger adminAuditLogger;
    private EmailService emailService;
    private EmailTemplateService emailTemplateService;
    private CustomerNotificationService customerNotificationService;
    private ProductChangeRequestService service;

    private final UUID adminId = UUID.randomUUID();
    private final UUID sellerId = UUID.randomUUID();
    private final UUID otherSellerId = UUID.randomUUID();
    private final UUID supplierId = UUID.randomUUID();

    @BeforeEach
    void setUp() {
        requestRepository = mock(ProductChangeRequestRepository.class);
        userRepository = mock(UserRepository.class);
        productRepository = mock(ProductRepository.class);
        productService = mock(ProductService.class);
        adminAuditLogger = mock(AdminAuditLogger.class);
        emailService = mock(EmailService.class);
        emailTemplateService = mock(EmailTemplateService.class);
        customerNotificationService = mock(CustomerNotificationService.class);

        service = new ProductChangeRequestService(
                requestRepository,
                userRepository,
                productService,
                productRepository,
                new ObjectMapper(),
                adminAuditLogger,
                emailService,
                emailTemplateService,
                customerNotificationService
        );
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private User userWithRole(UUID id, String roleName) {
        Role role = Role.builder().name(roleName).build();
        return User.builder()
                .id(id)
                .email(id + "@test.com")
                .roles(List.of(role))
                .build();
    }

    private ProductChangeRequest pendingRequest(UUID id, User requestedBy) {
        ProductChangeRequest req = new ProductChangeRequest();
        req.setId(id);
        req.setStatus(ProductChangeRequestStatus.PENDING);
        req.setActionType(ProductChangeAction.CREATE);
        req.setTargetProductId("P-001");
        req.setRequestPayload("{}");
        req.setRequestedBy(requestedBy);
        return req;
    }

    private ProductChangeRequest changesRequestedRequest(UUID id, User requestedBy) {
        ProductChangeRequest req = pendingRequest(id, requestedBy);
        req.setStatus(ProductChangeRequestStatus.CHANGES_REQUESTED);
        return req;
    }

    // ── requestChanges ────────────────────────────────────────────────────────

    @Test
    void requestChanges_requiresNonBlankNote() {
        UUID requestId = UUID.randomUUID();
        User admin = userWithRole(adminId, "ROLE_ADMIN");
        ProductChangeRequest req = pendingRequest(requestId, userWithRole(sellerId, "ROLE_SELLER"));
        when(requestRepository.findById(requestId)).thenReturn(Optional.of(req));

        assertThatThrownBy(() -> service.requestChanges(requestId, admin, ""))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("reviewer note is required");
    }

    @Test
    void requestChanges_transitionsPendingToChangesRequested() {
        UUID requestId = UUID.randomUUID();
        User admin = userWithRole(adminId, "ROLE_ADMIN");
        User seller = userWithRole(sellerId, "ROLE_SELLER");
        ProductChangeRequest req = pendingRequest(requestId, seller);

        when(requestRepository.findById(requestId)).thenReturn(Optional.of(req));
        when(requestRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        var result = service.requestChanges(requestId, admin, "Please add a product image.");

        assertThat(result.getStatus()).isEqualTo(ProductChangeRequestStatus.CHANGES_REQUESTED);
        assertThat(result.getReviewerNote()).isEqualTo("Please add a product image.");
    }

    @Test
    void requestChanges_rejectsAlreadyProcessedRequest() {
        UUID requestId = UUID.randomUUID();
        User admin = userWithRole(adminId, "ROLE_ADMIN");
        User seller = userWithRole(sellerId, "ROLE_SELLER");
        ProductChangeRequest req = pendingRequest(requestId, seller);
        req.setStatus(ProductChangeRequestStatus.APPROVED);

        when(requestRepository.findById(requestId)).thenReturn(Optional.of(req));

        assertThatThrownBy(() -> service.requestChanges(requestId, admin, "Some note"))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("already processed");
    }

    // ── resubmit ──────────────────────────────────────────────────────────────

    @Test
    void resubmit_transitionsChangesRequestedToPending() {
        UUID requestId = UUID.randomUUID();
        User seller = userWithRole(sellerId, "ROLE_SELLER");
        ProductChangeRequest req = changesRequestedRequest(requestId, seller);

        when(requestRepository.findById(requestId)).thenReturn(Optional.of(req));
        when(requestRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        var result = service.resubmit(requestId, seller);

        assertThat(result.getStatus()).isEqualTo(ProductChangeRequestStatus.PENDING);
        assertThat(result.getReviewerNote()).isNull();
        assertThat(result.getReviewedAt()).isNull();
    }

    @Test
    void resubmit_blocksOtherSeller() {
        UUID requestId = UUID.randomUUID();
        User seller = userWithRole(sellerId, "ROLE_SELLER");
        User otherSeller = userWithRole(otherSellerId, "ROLE_SELLER");
        ProductChangeRequest req = changesRequestedRequest(requestId, seller);

        when(requestRepository.findById(requestId)).thenReturn(Optional.of(req));

        assertThatThrownBy(() -> service.resubmit(requestId, otherSeller))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("not the owner");
    }

    @Test
    void resubmit_blocksIfStatusIsNotChangesRequested() {
        UUID requestId = UUID.randomUUID();
        User seller = userWithRole(sellerId, "ROLE_SELLER");
        ProductChangeRequest req = pendingRequest(requestId, seller);

        when(requestRepository.findById(requestId)).thenReturn(Optional.of(req));

        assertThatThrownBy(() -> service.resubmit(requestId, seller))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("CHANGES_REQUESTED");
    }

    // ── Ownership enforcement ─────────────────────────────────────────────────

    @Test
    void requestUpdate_blocksSellerFromModifyingOtherSellersProduct() {
        String productId = "P-OWNED-BY-OTHER";
        User seller = userWithRole(sellerId, "ROLE_SELLER");

        Product product = new Product();
        product.setProductID(productId);
        product.setSellerUserId(otherSellerId); // owned by a different seller

        when(productRepository.findByProductID(productId)).thenReturn(Optional.of(product));

        assertThatThrownBy(() -> service.requestUpdate(productId, null, seller))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("do not own this product");
    }

    @Test
    void requestDelete_blocksSupplierFromModifyingOtherSuppliersProduct() {
        String productId = "P-SUPPLIER-OTHER";
        User supplier = userWithRole(supplierId, "ROLE_SUPPLIER");

        Product product = new Product();
        product.setProductID(productId);
        product.setSupplierUserId(UUID.randomUUID()); // different supplier

        when(productRepository.findByProductID(productId)).thenReturn(Optional.of(product));

        assertThatThrownBy(() -> service.requestDelete(productId, supplier))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("do not own this product");
    }

    @Test
    void requestUpdate_allowsSellerToModifyOwnProduct() {
        String productId = "P-MY-PRODUCT";
        User seller = userWithRole(sellerId, "ROLE_SELLER");

        Product product = new Product();
        product.setProductID(productId);
        product.setSellerUserId(sellerId); // owned by this seller

        when(productRepository.findByProductID(productId)).thenReturn(Optional.of(product));
        when(requestRepository.save(any())).thenAnswer(inv -> {
            ProductChangeRequest req = inv.getArgument(0);
            req.setId(UUID.randomUUID()); // simulate JPA id generation
            return req;
        });

        // Should not throw
        service.requestUpdate(productId, null, seller);

        verify(requestRepository).save(any());
    }

    @Test
    void requestUpdate_allowsAdminToModifyAnyProduct() {
        String productId = "P-ANY";
        User admin = userWithRole(adminId, "ROLE_ADMIN");

        Product product = new Product();
        product.setProductID(productId);
        product.setSellerUserId(sellerId); // admin doesn't need to be the owner

        when(productRepository.findByProductID(productId)).thenReturn(Optional.of(product));
        when(requestRepository.save(any())).thenAnswer(inv -> {
            ProductChangeRequest req = inv.getArgument(0);
            req.setId(UUID.randomUUID()); // simulate JPA id generation
            return req;
        });

        service.requestUpdate(productId, null, admin);

        verify(requestRepository).save(any());
    }

    // ── Admin Authorization Defense-in-Depth ──────────────────────────────────

    @Test
    void approve_rejectsNonAdminReviewer() {
        UUID requestId = UUID.randomUUID();
        User employee = userWithRole(UUID.randomUUID(), "ROLE_EMPLOYEE");
        ProductChangeRequest req = pendingRequest(requestId, userWithRole(sellerId, "ROLE_SELLER"));

        when(requestRepository.findById(requestId)).thenReturn(Optional.of(req));

        assertThatThrownBy(() -> service.approve(requestId, employee, "Looks good"))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("Only administrators");
    }

    @Test
    void reject_rejectsNonAdminReviewer() {
        UUID requestId = UUID.randomUUID();
        User seller = userWithRole(sellerId, "ROLE_SELLER");
        ProductChangeRequest req = pendingRequest(requestId, seller);

        when(requestRepository.findById(requestId)).thenReturn(Optional.of(req));

        assertThatThrownBy(() -> service.reject(requestId, seller, "Reject"))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("Only administrators");
    }

    @Test
    void requestChanges_rejectsNonAdminReviewer() {
        UUID requestId = UUID.randomUUID();
        User employee = userWithRole(UUID.randomUUID(), "ROLE_EMPLOYEE");
        ProductChangeRequest req = pendingRequest(requestId, userWithRole(sellerId, "ROLE_SELLER"));

        when(requestRepository.findById(requestId)).thenReturn(Optional.of(req));

        assertThatThrownBy(() -> service.requestChanges(requestId, employee, "Fix images"))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("Only administrators");
    }

    @Test
    void requestChanges_sendsEmailNotification() {
        UUID requestId = UUID.randomUUID();
        User admin = userWithRole(adminId, "ROLE_ADMIN");
        User seller = userWithRole(sellerId, "ROLE_SELLER");
        ProductChangeRequest req = pendingRequest(requestId, seller);

        when(requestRepository.findById(requestId)).thenReturn(Optional.of(req));
        when(requestRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
        when(emailTemplateService.generateProductChangeRequestedEmail(any(), any(), any(), any()))
                .thenReturn("<html>mock email</html>");

        service.requestChanges(requestId, admin, "Please update description");

        verify(emailService).sendEmail(eq(seller.getEmail()), anyString(), anyString());
    }

    @Test
    void createRequest_blocksDuplicatePendingRequestForSameProduct() {
        String productId = "P-DUP-TEST";
        User seller = userWithRole(sellerId, "ROLE_SELLER");

        when(requestRepository.existsByTargetProductIdAndStatus(productId, ProductChangeRequestStatus.PENDING))
                .thenReturn(true);

        assertThatThrownBy(() -> service.requestUpdate(productId, null, seller))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("already pending review");
    }

    @Test
    void requestUpdate_blocksSellerFromModifyingSupplierOwnedProduct() {
        String productId = "P-SUPPLIER-PRODUCT";
        User seller = userWithRole(sellerId, "ROLE_SELLER");

        Product product = new Product();
        product.setProductID(productId);
        product.setSupplierUserId(supplierId);
        product.setSellerUserId(null); // not owned by any seller

        when(productRepository.findByProductID(productId)).thenReturn(Optional.of(product));

        assertThatThrownBy(() -> service.requestUpdate(productId, null, seller))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("do not own this product");
    }

    @Test
    void approve_whenDeleteRequest_callsDeleteProductAndApproves() {
        UUID requestId = UUID.randomUUID();
        User admin = userWithRole(adminId, "ROLE_ADMIN");
        User supplier = userWithRole(supplierId, "ROLE_SUPPLIER");
        ProductChangeRequest req = pendingRequest(requestId, supplier);
        req.setActionType(ProductChangeAction.DELETE);
        req.setTargetProductId("14");
        req.setRequestPayload("{\"productID\":\"14\"}");

        when(requestRepository.findById(requestId)).thenReturn(Optional.of(req));
        when(requestRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        var result = service.approve(requestId, admin, "Approved removal");

        assertThat(result.getStatus()).isEqualTo(ProductChangeRequestStatus.APPROVED);
        assertThat(result.getReviewerNote()).isEqualTo("Approved removal");
        verify(productService).deleteProduct("14");
    }
}
