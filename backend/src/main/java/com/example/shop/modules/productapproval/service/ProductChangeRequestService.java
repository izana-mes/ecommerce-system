package com.example.shop.modules.productapproval.service;

import com.example.shop.common.audit.AdminAuditLogger;
import com.example.shop.common.exception.BusinessException;
import com.example.shop.common.mail.EmailService;
import com.example.shop.common.mail.EmailTemplateService;
import com.example.shop.modules.product.dto.ProductDto;
import com.example.shop.modules.product.service.ProductService;
import com.example.shop.modules.productapproval.dto.ProductChangeRequestResponseDto;
import com.example.shop.modules.productapproval.entity.ProductChangeAction;
import com.example.shop.modules.productapproval.entity.ProductChangeRequest;
import com.example.shop.modules.productapproval.entity.ProductChangeRequestStatus;
import com.example.shop.modules.productapproval.repository.ProductChangeRequestRepository;
import com.example.shop.modules.role.entity.Role;
import com.example.shop.modules.user.entity.User;
import com.example.shop.modules.user.repository.UserRepository;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Transactional
@Slf4j
public class ProductChangeRequestService {

    private final ProductChangeRequestRepository productChangeRequestRepository;
    private final UserRepository userRepository;
    private final ProductService productService;
    private final ObjectMapper objectMapper;
    private final AdminAuditLogger adminAuditLogger;
    private final EmailService emailService;
    private final EmailTemplateService emailTemplateService;

    @Value("${application.bootstrap.admin.email:admin@example.com}")
    private String adminEmail;

    public ProductChangeRequestResponseDto requestCreate(ProductDto payload, User requester) {
        return createRequest(ProductChangeAction.CREATE, payload == null ? null : payload.getProductID(), payload, requester);
    }

    public ProductChangeRequestResponseDto requestUpdate(String productID, ProductDto payload, User requester) {
        return createRequest(ProductChangeAction.UPDATE, productID, payload, requester);
    }

    public ProductChangeRequestResponseDto requestDelete(String productID, User requester) {
        return createRequest(ProductChangeAction.DELETE, productID, Map.of("productID", productID), requester);
    }

    public ProductChangeRequestResponseDto requestBulkUpsert(List<ProductDto> payload, User requester) {
        return createRequest(ProductChangeAction.BULK_UPSERT, null, payload, requester);
    }

    @Transactional(readOnly = true)
    public List<ProductChangeRequestResponseDto> listRequestsForRequester(User requester) {
        if (requester == null || requester.getId() == null) {
            throw new BusinessException("Requester is required", HttpStatus.UNAUTHORIZED);
        }
        return productChangeRequestRepository.findAllByRequestedByIdOrderByCreatedAtDesc(requester.getId())
                .stream()
                .map(ProductChangeRequestResponseDto::fromEntity)
                .toList();
    }

    @Transactional(readOnly = true)
    public List<ProductChangeRequestResponseDto> listRequests(String status) {
        List<ProductChangeRequest> requests;
        if (!StringUtils.hasText(status)) {
            requests = productChangeRequestRepository.findAllByOrderByCreatedAtDesc();
        } else {
            ProductChangeRequestStatus normalizedStatus = parseStatus(status);
            requests = productChangeRequestRepository.findAllByStatusOrderByCreatedAtAsc(normalizedStatus);
        }
        return requests.stream().map(ProductChangeRequestResponseDto::fromEntity).toList();
    }

    public ProductChangeRequestResponseDto approve(UUID requestId, User reviewer, String note) {
        ProductChangeRequest request = getPendingRequest(requestId);
        applyApprovedChange(request);
        request.setStatus(ProductChangeRequestStatus.APPROVED);
        request.setReviewedBy(reviewer);
        request.setReviewerNote(trimToNull(note));
        request.setReviewedAt(LocalDateTime.now());
        ProductChangeRequest saved = productChangeRequestRepository.save(request);

        adminAuditLogger.log(
                "PRODUCT_CHANGE_REQUEST_APPROVED",
                actorEmail(reviewer),
                Map.of("requestId", requestId.toString(), "action", request.getActionType().name())
        );
        sendProductChangeReviewEmailSafely(saved, true);

        return ProductChangeRequestResponseDto.fromEntity(saved);
    }

    public ProductChangeRequestResponseDto reject(UUID requestId, User reviewer, String note) {
        ProductChangeRequest request = getPendingRequest(requestId);
        request.setStatus(ProductChangeRequestStatus.REJECTED);
        request.setReviewedBy(reviewer);
        request.setReviewerNote(trimToNull(note));
        request.setReviewedAt(LocalDateTime.now());
        ProductChangeRequest saved = productChangeRequestRepository.save(request);

        adminAuditLogger.log(
                "PRODUCT_CHANGE_REQUEST_REJECTED",
                actorEmail(reviewer),
                Map.of("requestId", requestId.toString(), "action", request.getActionType().name())
        );
        sendProductChangeReviewEmailSafely(saved, false);

        return ProductChangeRequestResponseDto.fromEntity(saved);
    }

    private ProductChangeRequestResponseDto createRequest(ProductChangeAction action, String targetProductId, Object payload, User requester) {
        if (requester == null) {
            throw new BusinessException("Requester is required", HttpStatus.UNAUTHORIZED);
        }

        ProductChangeRequest request = ProductChangeRequest.builder()
                .actionType(action)
                .targetProductId(trimToNull(targetProductId))
                .requestPayload(toJson(payload))
                .status(ProductChangeRequestStatus.PENDING)
                .requestedBy(requester)
                .build();

        ProductChangeRequest saved = productChangeRequestRepository.save(request);

        adminAuditLogger.log(
                "PRODUCT_CHANGE_REQUEST_SUBMITTED",
                actorEmail(requester),
                Map.of("requestId", saved.getId().toString(), "action", action.name())
        );
        sendProductChangeSubmissionEmailSafely(saved);

        return ProductChangeRequestResponseDto.fromEntity(saved);
    }

    private ProductChangeRequest getPendingRequest(UUID requestId) {
        ProductChangeRequest request = productChangeRequestRepository.findById(requestId)
                .orElseThrow(() -> new BusinessException("Product change request not found", HttpStatus.NOT_FOUND));
        if (request.getStatus() != ProductChangeRequestStatus.PENDING) {
            throw new BusinessException("Product change request is already processed", HttpStatus.BAD_REQUEST);
        }
        return request;
    }

    private ProductChangeRequestStatus parseStatus(String status) {
        String normalized = status.trim().toUpperCase(Locale.ROOT);
        try {
            return ProductChangeRequestStatus.valueOf(normalized);
        } catch (IllegalArgumentException ex) {
            throw new BusinessException("Unsupported status. Allowed values: pending, approved, rejected", HttpStatus.BAD_REQUEST);
        }
    }

    private void applyApprovedChange(ProductChangeRequest request) {
        try {
            switch (request.getActionType()) {
                case CREATE -> {
                    ProductDto payload = objectMapper.readValue(request.getRequestPayload(), ProductDto.class);
                    stripSupplierPin(payload);
                    productService.createProduct(payload);
                    UUID ownerAssigneeId = resolveCatalogOwnerAssignee(request);
                    if (ownerAssigneeId != null && StringUtils.hasText(payload.getProductID())) {
                        if (isSupplier(request.getRequestedBy())) {
                            productService.assignSupplierToProduct(payload.getProductID(), ownerAssigneeId);
                        } else if (isSeller(request.getRequestedBy())) {
                            productService.assignSellerToProduct(payload.getProductID(), ownerAssigneeId);
                        }
                    }
                }
                case UPDATE -> {
                    ProductDto payload = objectMapper.readValue(request.getRequestPayload(), ProductDto.class);
                    stripSupplierPin(payload);
                    productService.updateProduct(request.getTargetProductId(), payload);
                }
                case DELETE -> productService.deleteProduct(request.getTargetProductId());
                case BULK_UPSERT -> {
                    List<ProductDto> payload = objectMapper.readValue(
                            request.getRequestPayload(),
                            new TypeReference<>() {
                            }
                    );
                    if (payload != null) {
                        payload.forEach(ProductChangeRequestService::stripSupplierPin);
                    }
                    productService.saveAllProducts(payload);
                }
            }
        } catch (JsonProcessingException ex) {
            throw new BusinessException("Invalid request payload", HttpStatus.BAD_REQUEST);
        }
    }

    private static void stripSupplierPin(ProductDto dto) {
        if (dto != null) {
            dto.setSupplierUserId(null);
        }
    }

    private UUID resolveCatalogOwnerAssignee(ProductChangeRequest request) {
        User ref = request.getRequestedBy();
        if (ref == null || ref.getId() == null) {
            return null;
        }
        User loaded = userRepository.findById(ref.getId()).orElse(null);
        if (loaded == null || loaded.getRoles() == null) {
            return null;
        }
        return (isSupplier(loaded) || isSeller(loaded)) ? loaded.getId() : null;
    }

    private boolean isSupplier(User user) {
        return hasRole(user, "ROLE_SUPPLIER");
    }

    private boolean isSeller(User user) {
        return hasRole(user, "ROLE_SELLER");
    }

    private boolean hasRole(User user, String roleName) {
        return user != null
                && user.getRoles() != null
                && user.getRoles().stream().map(Role::getName).anyMatch(roleName::equals);
    }

    private String toJson(Object payload) {
        try {
            return objectMapper.writeValueAsString(payload == null ? Map.of() : payload);
        } catch (JsonProcessingException ex) {
            throw new IllegalStateException("Failed to serialize product change request payload");
        }
    }

    private String actorEmail(User actor) {
        return actor == null ? "unknown" : String.valueOf(actor.getEmail());
    }

    private String trimToNull(String value) {
        if (!StringUtils.hasText(value)) {
            return null;
        }
        return value.trim();
    }

    private void sendProductChangeReviewEmail(ProductChangeRequest request, boolean approved) {
        User requester = request.getRequestedBy();
        if (requester == null || !StringUtils.hasText(requester.getEmail())) {
            return;
        }
        String subject = approved
                ? "Product request approved"
                : "Product request rejected";
        String content = emailTemplateService.generateProductChangeReviewEmail(
                fullName(requester),
                approved,
                humanizeAction(request.getActionType()),
                resolveProductLabel(request),
                request.getReviewerNote()
        );
        emailService.sendEmail(requester.getEmail(), subject, content);
    }

    private void sendProductChangeReviewEmailSafely(ProductChangeRequest request, boolean approved) {
        try {
            sendProductChangeReviewEmail(request, approved);
        } catch (RuntimeException ex) {
            log.error(
                    "Failed to send product change review email for request {}",
                    request == null ? null : request.getId(),
                    ex
            );
        }
    }

    private void sendProductChangeSubmissionEmail(ProductChangeRequest request) {
        if (request == null || !StringUtils.hasText(adminEmail)) {
            return;
        }
        User requester = request.getRequestedBy();
        String subject = "New supplier product submission";
        String content = emailTemplateService.generateProductChangeSubmissionEmail(
                fullName(requester),
                requester == null ? null : requester.getEmail(),
                humanizeAction(request.getActionType()),
                resolveProductLabel(request)
        );
        emailService.sendEmail(adminEmail, subject, content);
    }

    private void sendProductChangeSubmissionEmailSafely(ProductChangeRequest request) {
        try {
            sendProductChangeSubmissionEmail(request);
        } catch (RuntimeException ex) {
            log.error(
                    "Failed to send product change submission email for request {}",
                    request == null ? null : request.getId(),
                    ex
            );
        }
    }

    private String resolveProductLabel(ProductChangeRequest request) {
        try {
            return switch (request.getActionType()) {
                case CREATE, UPDATE -> {
                    ProductDto payload = objectMapper.readValue(request.getRequestPayload(), ProductDto.class);
                    String productName = trimToNull(payload.getProductName());
                    yield StringUtils.hasText(productName) ? productName : trimToNull(payload.getProductID());
                }
                case DELETE -> trimToNull(request.getTargetProductId());
                case BULK_UPSERT -> {
                    List<ProductDto> payload = objectMapper.readValue(
                            request.getRequestPayload(),
                            new TypeReference<>() {
                            }
                    );
                    String names = payload.stream()
                            .map(ProductDto::getProductName)
                            .filter(StringUtils::hasText)
                            .map(String::trim)
                            .limit(3)
                            .collect(Collectors.joining(", "));
                    if (StringUtils.hasText(names)) {
                        yield payload.size() > 3 ? names + " and more" : names;
                    }
                    yield payload.isEmpty() ? "your submitted products" : payload.size() + " submitted products";
                }
            };
        } catch (JsonProcessingException ex) {
            return trimToNull(request.getTargetProductId());
        }
    }

    private String humanizeAction(ProductChangeAction action) {
        return switch (action) {
            case CREATE -> "create request";
            case UPDATE -> "update request";
            case DELETE -> "delete request";
            case BULK_UPSERT -> "bulk product request";
        };
    }

    private String fullName(User user) {
        if (user == null) {
            return null;
        }
        String fullName = ((user.getFirstName() == null ? "" : user.getFirstName().trim()) + " "
                + (user.getLastName() == null ? "" : user.getLastName().trim())).trim();
        return fullName.isBlank() ? user.getEmail() : fullName;
    }
}
