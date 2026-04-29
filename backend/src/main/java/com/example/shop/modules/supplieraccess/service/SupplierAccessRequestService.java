package com.example.shop.modules.supplieraccess.service;

import com.example.shop.common.audit.AdminAuditLogger;
import com.example.shop.common.exception.BusinessException;
import com.example.shop.common.mail.EmailService;
import com.example.shop.common.mail.EmailTemplateService;
import com.example.shop.modules.role.entity.Role;
import com.example.shop.modules.role.repository.RoleRepository;
import com.example.shop.modules.supplieraccess.dto.SupplierAccessRequestResponseDto;
import com.example.shop.modules.supplieraccess.dto.request.CreateSupplierAccessRequestDto;
import com.example.shop.modules.supplieraccess.entity.SupplierAccessRequest;
import com.example.shop.modules.supplieraccess.entity.SupplierAccessRequestStatus;
import com.example.shop.modules.supplieraccess.repository.SupplierAccessRequestRepository;
import com.example.shop.modules.user.entity.User;
import com.example.shop.modules.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Transactional
@Slf4j
public class SupplierAccessRequestService {

    private static final String ROLE_SUPPLIER = "ROLE_SUPPLIER";

    private final SupplierAccessRequestRepository supplierAccessRequestRepository;
    private final RoleRepository roleRepository;
    private final UserRepository userRepository;
    private final AdminAuditLogger adminAuditLogger;
    private final EmailService emailService;
    private final EmailTemplateService emailTemplateService;

    @Value("${application.bootstrap.admin.email:admin@example.com}")
    private String adminEmail;

    public SupplierAccessRequestResponseDto createRequest(CreateSupplierAccessRequestDto payload, User requester) {
        if (requester == null) {
            throw new BusinessException("Requester is required", HttpStatus.UNAUTHORIZED);
        }
        if (hasRole(requester, ROLE_SUPPLIER)) {
            throw new BusinessException("You already have supplier access", HttpStatus.BAD_REQUEST);
        }
        if (supplierAccessRequestRepository.existsByRequestedByIdAndStatus(requester.getId(), SupplierAccessRequestStatus.PENDING)) {
            throw new BusinessException("You already have a pending supplier access request", HttpStatus.CONFLICT);
        }

        SupplierAccessRequest request = SupplierAccessRequest.builder()
                .requestedBy(loadUser(requester.getId()))
                .businessName(trimToNull(payload == null ? null : payload.getBusinessName()))
                .websiteUrl(trimToNull(payload == null ? null : payload.getWebsiteUrl()))
                .contactPhone(trimToNull(payload == null ? null : payload.getContactPhone()))
                .note(trimToNull(payload == null ? null : payload.getNote()))
                .status(SupplierAccessRequestStatus.PENDING)
                .build();

        SupplierAccessRequest saved = supplierAccessRequestRepository.save(request);
        adminAuditLogger.log(
                "SUPPLIER_ACCESS_REQUEST_SUBMITTED",
                actorEmail(requester),
                Map.of("requestId", saved.getId().toString())
        );
        sendSupplierAccessSubmissionEmailSafely(saved, requester);
        return SupplierAccessRequestResponseDto.fromEntity(saved);
    }

    @Transactional(readOnly = true)
    public SupplierAccessRequestResponseDto getLatestForCurrentUser(User requester) {
        if (requester == null) {
            throw new BusinessException("Requester is required", HttpStatus.UNAUTHORIZED);
        }
        return supplierAccessRequestRepository.findFirstByRequestedByIdOrderByCreatedAtDesc(requester.getId())
                .map(SupplierAccessRequestResponseDto::fromEntity)
                .orElse(null);
    }

    @Transactional(readOnly = true)
    public List<SupplierAccessRequestResponseDto> listRequests(String status) {
        List<SupplierAccessRequest> requests;
        if (!StringUtils.hasText(status)) {
            requests = supplierAccessRequestRepository.findAllByOrderByCreatedAtDesc();
        } else {
            requests = supplierAccessRequestRepository.findAllByStatusOrderByCreatedAtAsc(parseStatus(status));
        }
        return requests.stream().map(SupplierAccessRequestResponseDto::fromEntity).toList();
    }

    public SupplierAccessRequestResponseDto approve(UUID requestId, User reviewer, String note) {
        SupplierAccessRequest request = getPendingRequest(requestId);
        User supplier = loadUser(request.getRequestedBy().getId());

        if (!hasRole(supplier, ROLE_SUPPLIER)) {
            Role supplierRole = roleRepository.findByName(ROLE_SUPPLIER)
                    .orElseGet(() -> roleRepository.save(Role.builder().name(ROLE_SUPPLIER).build()));
            List<Role> roles = new ArrayList<>(supplier.getRoles() == null ? List.of() : supplier.getRoles());
            roles.add(supplierRole);
            supplier.setRoles(roles);
            userRepository.save(supplier);
        }

        request.setStatus(SupplierAccessRequestStatus.APPROVED);
        request.setReviewedBy(loadUser(reviewer.getId()));
        request.setReviewerNote(trimToNull(note));
        request.setReviewedAt(LocalDateTime.now());
        SupplierAccessRequest saved = supplierAccessRequestRepository.save(request);

        adminAuditLogger.log(
                "SUPPLIER_ACCESS_REQUEST_APPROVED",
                actorEmail(reviewer),
                Map.of("requestId", requestId.toString(), "supplierUserId", supplier.getId().toString())
        );
        sendSupplierAccessReviewEmailSafely(saved, supplier, true);
        return SupplierAccessRequestResponseDto.fromEntity(saved);
    }

    public SupplierAccessRequestResponseDto reject(UUID requestId, User reviewer, String note) {
        SupplierAccessRequest request = getPendingRequest(requestId);
        request.setStatus(SupplierAccessRequestStatus.REJECTED);
        request.setReviewedBy(loadUser(reviewer.getId()));
        request.setReviewerNote(trimToNull(note));
        request.setReviewedAt(LocalDateTime.now());
        SupplierAccessRequest saved = supplierAccessRequestRepository.save(request);

        adminAuditLogger.log(
                "SUPPLIER_ACCESS_REQUEST_REJECTED",
                actorEmail(reviewer),
                Map.of("requestId", requestId.toString())
        );
        sendSupplierAccessReviewEmailSafely(saved, loadUser(saved.getRequestedBy().getId()), false);
        return SupplierAccessRequestResponseDto.fromEntity(saved);
    }

    private SupplierAccessRequest getPendingRequest(UUID requestId) {
        SupplierAccessRequest request = supplierAccessRequestRepository.findById(requestId)
                .orElseThrow(() -> new BusinessException("Supplier access request not found", HttpStatus.NOT_FOUND));
        if (request.getStatus() != SupplierAccessRequestStatus.PENDING) {
            throw new BusinessException("Supplier access request is already processed", HttpStatus.BAD_REQUEST);
        }
        return request;
    }

    private SupplierAccessRequestStatus parseStatus(String status) {
        try {
            return SupplierAccessRequestStatus.valueOf(status.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException ex) {
            throw new BusinessException("Unsupported status. Allowed values: pending, approved, rejected", HttpStatus.BAD_REQUEST);
        }
    }

    private User loadUser(UUID userId) {
        return userRepository.findById(userId)
                .orElseThrow(() -> new BusinessException("User not found", HttpStatus.NOT_FOUND));
    }

    private boolean hasRole(User user, String roleName) {
        return user != null
                && user.getRoles() != null
                && user.getRoles().stream().anyMatch(role -> roleName.equalsIgnoreCase(role.getName()));
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

    private void sendSupplierAccessReviewEmail(SupplierAccessRequest request, User supplier, boolean approved) {
        if (supplier == null || !StringUtils.hasText(supplier.getEmail())) {
            return;
        }
        String subject = approved
                ? "Supplier access request approved"
                : "Supplier access request rejected";
        String content = emailTemplateService.generateSupplierAccessReviewEmail(
                fullName(supplier),
                approved,
                request.getBusinessName(),
                request.getReviewerNote()
        );
        emailService.sendEmail(supplier.getEmail(), subject, content);
    }

    private void sendSupplierAccessReviewEmailSafely(SupplierAccessRequest request, User supplier, boolean approved) {
        try {
            sendSupplierAccessReviewEmail(request, supplier, approved);
        } catch (RuntimeException ex) {
            log.error(
                    "Failed to send supplier access review email for request {}",
                    request == null ? null : request.getId(),
                    ex
            );
        }
    }

    private void sendSupplierAccessSubmissionEmail(SupplierAccessRequest request, User requester) {
        if (!StringUtils.hasText(adminEmail)) {
            return;
        }
        String subject = "New supplier access request";
        String content = emailTemplateService.generateSupplierAccessSubmissionEmail(
                fullName(requester),
                requester == null ? null : requester.getEmail(),
                request == null ? null : request.getBusinessName(),
                request == null ? null : request.getWebsiteUrl(),
                request == null ? null : request.getContactPhone(),
                request == null ? null : request.getNote()
        );
        emailService.sendEmail(adminEmail, subject, content);
    }

    private void sendSupplierAccessSubmissionEmailSafely(SupplierAccessRequest request, User requester) {
        try {
            sendSupplierAccessSubmissionEmail(request, requester);
        } catch (RuntimeException ex) {
            log.error(
                    "Failed to send supplier access submission email for request {}",
                    request == null ? null : request.getId(),
                    ex
            );
        }
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
