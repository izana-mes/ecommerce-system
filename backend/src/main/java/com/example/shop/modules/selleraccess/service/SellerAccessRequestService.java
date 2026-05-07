package com.example.shop.modules.selleraccess.service;

import com.example.shop.common.audit.AdminAuditLogger;
import com.example.shop.common.exception.BusinessException;
import com.example.shop.common.mail.EmailService;
import com.example.shop.common.mail.EmailTemplateService;
import com.example.shop.modules.role.entity.Role;
import com.example.shop.modules.role.repository.RoleRepository;
import com.example.shop.modules.selleraccess.dto.SellerAccessRequestResponseDto;
import com.example.shop.modules.selleraccess.dto.request.CreateSellerAccessRequestDto;
import com.example.shop.modules.selleraccess.entity.SellerAccessRequest;
import com.example.shop.modules.selleraccess.entity.SellerAccessRequestStatus;
import com.example.shop.modules.selleraccess.repository.SellerAccessRequestRepository;
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
public class SellerAccessRequestService {

    private static final String ROLE_SELLER = "ROLE_SELLER";

    private final SellerAccessRequestRepository sellerAccessRequestRepository;
    private final RoleRepository roleRepository;
    private final UserRepository userRepository;
    private final AdminAuditLogger adminAuditLogger;
    private final EmailService emailService;
    private final EmailTemplateService emailTemplateService;

    @Value("${application.bootstrap.admin.email:admin@example.com}")
    private String adminEmail;

    public SellerAccessRequestResponseDto createRequest(CreateSellerAccessRequestDto payload, User requester) {
        if (requester == null) {
            throw new BusinessException("Requester is required", HttpStatus.UNAUTHORIZED);
        }
        if (hasRole(requester, ROLE_SELLER)) {
            throw new BusinessException("You already have seller access", HttpStatus.BAD_REQUEST);
        }
        if (sellerAccessRequestRepository.existsByRequestedByIdAndStatus(requester.getId(), SellerAccessRequestStatus.PENDING)) {
            throw new BusinessException("You already have a pending seller access request", HttpStatus.CONFLICT);
        }

        SellerAccessRequest request = SellerAccessRequest.builder()
                .requestedBy(loadUser(requester.getId()))
                .businessName(trimToNull(payload == null ? null : payload.getBusinessName()))
                .websiteUrl(trimToNull(payload == null ? null : payload.getWebsiteUrl()))
                .contactPhone(trimToNull(payload == null ? null : payload.getContactPhone()))
                .note(trimToNull(payload == null ? null : payload.getNote()))
                .status(SellerAccessRequestStatus.PENDING)
                .build();

        SellerAccessRequest saved = sellerAccessRequestRepository.save(request);
        adminAuditLogger.log(
                "SELLER_ACCESS_REQUEST_SUBMITTED",
                actorEmail(requester),
                Map.of("requestId", saved.getId().toString())
        );
        sendSellerAccessSubmissionEmailSafely(saved, requester);
        return SellerAccessRequestResponseDto.fromEntity(saved);
    }

    @Transactional(readOnly = true)
    public SellerAccessRequestResponseDto getLatestForCurrentUser(User requester) {
        if (requester == null) {
            throw new BusinessException("Requester is required", HttpStatus.UNAUTHORIZED);
        }
        return sellerAccessRequestRepository.findFirstByRequestedByIdOrderByCreatedAtDesc(requester.getId())
                .map(SellerAccessRequestResponseDto::fromEntity)
                .orElse(null);
    }

    @Transactional(readOnly = true)
    public List<SellerAccessRequestResponseDto> listRequests(String status) {
        List<SellerAccessRequest> requests;
        if (!StringUtils.hasText(status)) {
            requests = sellerAccessRequestRepository.findAllByOrderByCreatedAtDesc();
        } else {
            requests = sellerAccessRequestRepository.findAllByStatusOrderByCreatedAtAsc(parseStatus(status));
        }
        return requests.stream().map(SellerAccessRequestResponseDto::fromEntity).toList();
    }

    public SellerAccessRequestResponseDto approve(UUID requestId, User reviewer, String note) {
        SellerAccessRequest request = getPendingRequest(requestId);
        User seller = loadUser(request.getRequestedBy().getId());

        if (!hasRole(seller, ROLE_SELLER)) {
            Role sellerRole = roleRepository.findByName(ROLE_SELLER)
                    .orElseGet(() -> roleRepository.save(Role.builder().name(ROLE_SELLER).build()));
            List<Role> roles = new ArrayList<>(seller.getRoles() == null ? List.of() : seller.getRoles());
            roles.add(sellerRole);
            seller.setRoles(roles);
            userRepository.save(seller);
        }

        request.setStatus(SellerAccessRequestStatus.APPROVED);
        request.setReviewedBy(loadUser(reviewer.getId()));
        request.setReviewerNote(trimToNull(note));
        request.setReviewedAt(LocalDateTime.now());
        SellerAccessRequest saved = sellerAccessRequestRepository.save(request);

        adminAuditLogger.log(
                "SELLER_ACCESS_REQUEST_APPROVED",
                actorEmail(reviewer),
                Map.of("requestId", requestId.toString(), "sellerUserId", seller.getId().toString())
        );
        sendSellerAccessReviewEmailSafely(saved, seller, true);
        return SellerAccessRequestResponseDto.fromEntity(saved);
    }

    public SellerAccessRequestResponseDto reject(UUID requestId, User reviewer, String note) {
        SellerAccessRequest request = getPendingRequest(requestId);
        request.setStatus(SellerAccessRequestStatus.REJECTED);
        request.setReviewedBy(loadUser(reviewer.getId()));
        request.setReviewerNote(trimToNull(note));
        request.setReviewedAt(LocalDateTime.now());
        SellerAccessRequest saved = sellerAccessRequestRepository.save(request);

        adminAuditLogger.log(
                "SELLER_ACCESS_REQUEST_REJECTED",
                actorEmail(reviewer),
                Map.of("requestId", requestId.toString())
        );
        sendSellerAccessReviewEmailSafely(saved, loadUser(saved.getRequestedBy().getId()), false);
        return SellerAccessRequestResponseDto.fromEntity(saved);
    }

    private SellerAccessRequest getPendingRequest(UUID requestId) {
        SellerAccessRequest request = sellerAccessRequestRepository.findById(requestId)
                .orElseThrow(() -> new BusinessException("Seller access request not found", HttpStatus.NOT_FOUND));
        if (request.getStatus() != SellerAccessRequestStatus.PENDING) {
            throw new BusinessException("Seller access request is already processed", HttpStatus.BAD_REQUEST);
        }
        return request;
    }

    private SellerAccessRequestStatus parseStatus(String status) {
        try {
            return SellerAccessRequestStatus.valueOf(status.trim().toUpperCase(Locale.ROOT));
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

    private void sendSellerAccessReviewEmail(SellerAccessRequest request, User seller, boolean approved) {
        if (seller == null || !StringUtils.hasText(seller.getEmail())) {
            return;
        }
        String subject = approved
                ? "Seller access request approved"
                : "Seller access request rejected";
        String content = emailTemplateService.generateSellerAccessReviewEmail(
                fullName(seller),
                approved,
                request.getBusinessName(),
                request.getReviewerNote()
        );
        emailService.sendEmail(seller.getEmail(), subject, content);
    }

    private void sendSellerAccessReviewEmailSafely(SellerAccessRequest request, User seller, boolean approved) {
        try {
            sendSellerAccessReviewEmail(request, seller, approved);
        } catch (RuntimeException ex) {
            log.error(
                    "Failed to send seller access review email for request {}",
                    request == null ? null : request.getId(),
                    ex
            );
        }
    }

    private void sendSellerAccessSubmissionEmail(SellerAccessRequest request, User requester) {
        if (!StringUtils.hasText(adminEmail)) {
            return;
        }
        String subject = "New seller access request";
        String content = emailTemplateService.generateSellerAccessSubmissionEmail(
                fullName(requester),
                requester == null ? null : requester.getEmail(),
                request == null ? null : request.getBusinessName(),
                request == null ? null : request.getWebsiteUrl(),
                request == null ? null : request.getContactPhone(),
                request == null ? null : request.getNote()
        );
        emailService.sendEmail(adminEmail, subject, content);
    }

    private void sendSellerAccessSubmissionEmailSafely(SellerAccessRequest request, User requester) {
        try {
            sendSellerAccessSubmissionEmail(request, requester);
        } catch (RuntimeException ex) {
            log.error(
                    "Failed to send seller access submission email for request {}",
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

