package com.example.shop.modules.resale.service;

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
import com.example.shop.modules.selleraccess.entity.SellerAccessRequest;
import com.example.shop.modules.selleraccess.repository.SellerAccessRequestRepository;
import com.example.shop.modules.user.entity.User;
import com.example.shop.modules.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.time.LocalDateTime;
import java.util.*;

@Service
@RequiredArgsConstructor
@Slf4j
public class ResaleServiceImpl implements ResaleService {

    private final SupplierResaleCatalogFlagRepository flagRepository;
    private final SupplierProductRepository supplierProductRepository;
    private final SellerResaleRequestRepository requestRepository;
    private final SellerResaleAuthorizationRepository authorizationRepository;
    private final SellerProductListingRepository listingRepository;
    private final SellerProductAllocationRepository allocationRepository;
    private final JdbcTemplate jdbcTemplate;
    private final ProductRepository productRepository;
    private final UserRepository userRepository;
    private final SellerAccessRequestRepository sellerAccessRequestRepository;
    private final CustomerNotificationService notificationService;
    private final EmailService emailService;
    private final EmailTemplateService emailTemplateService;
    private final AdminAuditLogger adminAuditLogger;

    // =====================================================
    // Supplier: Catalog Flag Management
    // =====================================================

    @Override
    @Transactional
    public SupplierResaleCatalogFlagDto setResaleFlag(String productId, boolean enabled, String commercialNote, User supplier) {
        return setResaleTerms(productId, enabled, commercialNote, null, null, supplier);
    }

    @Override
    @Transactional
    public SupplierResaleCatalogFlagDto setResaleTerms(String productId, boolean enabled, String commercialNote, java.math.BigDecimal wholesalePrice, Integer minimumOrderQuantity, User supplier) {
        requireSupplier(supplier);
        Product product = requireProduct(productId);
        if (product.getSupplierUserId() == null || !supplier.getId().equals(product.getSupplierUserId())) {
            throw new BusinessException("You can only manage your own products", HttpStatus.FORBIDDEN);
        }
        SupplierResaleCatalogFlag flag = flagRepository.findByProductId(productId)
                .orElseGet(() -> SupplierResaleCatalogFlag.builder()
                        .productId(productId)
                        .supplierUserId(supplier.getId())
                        .build());
        flag.setResaleEnabled(enabled);
        flag.setCommercialNote(trimToNull(commercialNote));
        if (wholesalePrice != null && wholesalePrice.signum() <= 0) throw new BusinessException("Wholesale price must be positive", HttpStatus.BAD_REQUEST);
        if (enabled && wholesalePrice == null && flag.getWholesalePrice() == null) throw new BusinessException("Wholesale price is required to enable Seller distribution", HttpStatus.BAD_REQUEST);
        if (minimumOrderQuantity != null && minimumOrderQuantity <= 0) throw new BusinessException("MOQ must be positive", HttpStatus.BAD_REQUEST);
        if (wholesalePrice != null) flag.setWholesalePrice(wholesalePrice);
        if (minimumOrderQuantity != null) flag.setMinimumOrderQuantity(minimumOrderQuantity);
        SupplierResaleCatalogFlag saved = flagRepository.save(flag);
        SupplierProduct offer = supplierProductRepository.findBySupplierIdAndProductProductID(supplier.getId(), productId)
                .orElseGet(() -> SupplierProduct.builder().supplier(supplier).product(product)
                        .stockQuantity(product.getStockQuantity() == null ? 0 : product.getStockQuantity())
                        .reservedQuantity(0).minimumOrderQuantity(1).approved(false).available(false)
                        .directRetailEnabled(false).build());
        if (wholesalePrice != null) offer.setWholesalePrice(wholesalePrice);
        else if (offer.getWholesalePrice() == null) offer.setWholesalePrice(flag.getWholesalePrice());
        if (minimumOrderQuantity != null) offer.setMinimumOrderQuantity(minimumOrderQuantity);
        offer.setSupplierSku(product.getSku());
        offer.setSupplyTerms(trimToNull(commercialNote));
        offer.setAvailable(enabled);
        offer.setAllowResale(enabled);
        offer.setApproved(Boolean.TRUE.equals(flag.getSupplierProductApproved()));
        supplierProductRepository.save(offer);
        adminAuditLogger.log("RESALE_FLAG_UPDATED", supplier.getEmail(),
                Map.of("productId", productId, "enabled", enabled));
        SupplierResaleCatalogFlagDto dto = SupplierResaleCatalogFlagDto.fromEntity(saved);
        dto.setProductName(product.getProductName());
        dto.setProductPrice(product.getProductPrice());
        dto.setFrontImg(product.getFrontImg());
        return dto;
    }

    @Override
    @Transactional(readOnly = true)
    public List<SupplierResaleCatalogFlagDto> listSupplierCatalogFlags(User supplier) {
        requireSupplier(supplier);
        List<SupplierResaleCatalogFlag> flags = flagRepository.findBySupplierUserIdOrderByCreatedAtDesc(supplier.getId());
        return flags.stream().map(f -> {
            SupplierResaleCatalogFlagDto dto = SupplierResaleCatalogFlagDto.fromEntity(f);
            productRepository.findByProductID(f.getProductId()).ifPresent(p -> {
                dto.setProductName(p.getProductName());
                dto.setProductPrice(p.getProductPrice());
                dto.setFrontImg(p.getFrontImg());
            });
            return dto;
        }).toList();
    }

    @Override
    @Transactional
    public void approveSupplierCatalogProduct(String productId) {
        SupplierResaleCatalogFlag flag = flagRepository.findByProductId(productId)
                .orElseThrow(() -> new BusinessException("Supplier offer not found", HttpStatus.NOT_FOUND));
        Product product = requireProduct(productId);
        if (!Boolean.TRUE.equals(product.getActive())) throw new BusinessException("Global product must be approved and active first", HttpStatus.CONFLICT);
        flag.setSupplierProductApproved(true);
        flagRepository.save(flag);
        supplierProductRepository.findBySupplierIdAndProductProductID(flag.getSupplierUserId(), productId).ifPresent(offer -> {
            offer.setApproved(true);
            supplierProductRepository.save(offer);
        });
    }

    @Override
    @Transactional(readOnly = true)
    public Page<SupplierResaleCatalogFlagDto> adminListPendingSupplierProducts(Pageable pageable) {
        return flagRepository.findByResaleEnabledTrueAndSupplierProductApprovedFalseOrderByCreatedAtDesc(pageable).map(flag -> {
            SupplierResaleCatalogFlagDto dto = SupplierResaleCatalogFlagDto.fromEntity(flag);
            productRepository.findByProductID(flag.getProductId()).ifPresent(product -> {
                dto.setProductName(product.getProductName());
                dto.setProductPrice(product.getProductPrice());
                dto.setFrontImg(product.getFrontImg());
            });
            userRepository.findById(flag.getSupplierUserId()).ifPresent(supplier -> dto.setSupplierUserId(supplier.getId()));
            return dto;
        });
    }

    // =====================================================
    // Seller: Browse Catalog
    // =====================================================

    @Override
    @Transactional(readOnly = true)
    public Page<SupplierCatalogProductDto> browseSupplierCatalog(UUID supplierFilter, String category, String q, String brand, String sku, User seller, Pageable pageable) {
        requireSeller(seller);
        List<SupplierCatalogProductDto> items = new ArrayList<>();
        for (SupplierProduct offer : supplierProductRepository.findEligibleOffers()) {
            if (supplierFilter != null && !supplierFilter.equals(offer.getSupplier().getId())) continue;
            Product product = offer.getProduct();
            if (!Boolean.TRUE.equals(product.getActive())) continue;
            String search = normalizeSearch(q);
            String searchable = normalizeSearch(product.getProductName() + " " + product.getProductID() + " " + offer.getSupplierSku() + " " + product.getSku() + " " + product.getBrand() + " " + product.getCategory());
            if (!search.isBlank() && !searchable.contains(search)) continue;
            if (StringUtils.hasText(sku) && !normalizeSearch((offer.getSupplierSku() == null ? "" : offer.getSupplierSku()) + " " + product.getSku()).contains(normalizeSearch(sku))) continue;
            if (StringUtils.hasText(brand) && !normalizeSearch(product.getBrand()).contains(normalizeSearch(brand))) continue;
            if (StringUtils.hasText(category) && !normalizeSearch(product.getCategory()).equals(normalizeSearch(category))) continue;

            String myRequestStatus = null;
            String myRequestId = null;
            List<SellerResaleRequest> myReqs = requestRepository
                    .findBySellerIdAndSupplierOfferIdOrderByCreatedAtDesc(seller.getId(), offer.getId());
            if (!myReqs.isEmpty()) {
                SellerResaleRequest latest = myReqs.get(0);
                myRequestStatus = latest.getStatus().name();
                myRequestId = latest.getId().toString();
            }
            boolean hasAuth = authorizationRepository.existsBySellerIdAndSupplierOfferIdAndActiveTrue(seller.getId(), offer.getId());

            User supplierUser = offer.getSupplier();

            items.add(SupplierCatalogProductDto.builder()
                    .productId(product.getProductID())
                    .supplierProductId(offer.getId())
                    .productName(product.getProductName())
                    .sku(offer.getSupplierSku() == null ? product.getSku() : offer.getSupplierSku())
                    .brand(product.getBrand())
                    .category(product.getCategory())
                    .productPrice(product.getProductPrice())
                    .wholesalePrice(offer.getWholesalePrice())
                    .stockQuantity(Math.max(0, offer.getStockQuantity() - offer.getReservedQuantity()))
                    .minimumOrderQuantity(offer.getMinimumOrderQuantity())
                    .availableToSellers(Boolean.TRUE.equals(offer.getAvailable()) && Boolean.TRUE.equals(offer.getApproved()) && offer.getStockQuantity() - offer.getReservedQuantity() >= offer.getMinimumOrderQuantity())
                    .allowResale(Boolean.TRUE.equals(offer.getAllowResale()))
                    .frontImg(product.getFrontImg())
                    .backImg(product.getBackImg())
                    .productReviews(product.getProductReviews())
                    .active(product.getActive())
                    .supplierUserId(offer.getSupplier().getId())
                    .supplierDisplayName(supplierUser == null ? null : displayName(supplierUser))
                    .commercialNote(offer.getSupplyTerms())
                    .myRequestStatus(myRequestStatus)
                    .myRequestId(myRequestId)
                    .hasActiveAuthorization(hasAuth)
                    .build());
        }

        if (pageable.getSort().isSorted()) {
            org.springframework.data.domain.Sort.Order order = pageable.getSort().iterator().next();
            Comparator<SupplierCatalogProductDto> comparator = switch (order.getProperty()) {
                case "productPrice" -> Comparator.comparing(SupplierCatalogProductDto::getWholesalePrice, Comparator.nullsLast(Comparator.naturalOrder()));
                case "stockQuantity" -> Comparator.comparing(SupplierCatalogProductDto::getStockQuantity, Comparator.nullsLast(Comparator.naturalOrder()));
                default -> Comparator.comparing(SupplierCatalogProductDto::getProductName, String.CASE_INSENSITIVE_ORDER);
            };
            if (order.isDescending()) comparator = comparator.reversed();
            items.sort(comparator);
        }

        int start = (int) Math.min(pageable.getOffset(), items.size());
        int end = Math.min(start + pageable.getPageSize(), items.size());
        return new PageImpl<>(items.subList(start, end), pageable, items.size());
    }

    // =====================================================
    // Seller: Resale Requests
    // =====================================================

    @Override
    @Transactional
    public ResaleRequestResponseDto submitRequest(SubmitResaleRequestDto dto, User seller) {
        requireSeller(seller);
        if (dto == null || !StringUtils.hasText(dto.getSupplierProductId())) {
            throw new BusinessException("Product ID is required", HttpStatus.BAD_REQUEST);
        }
        String requestedOfferId = dto.getSupplierProductId().trim();
        SupplierProduct selectedOffer = null;
        try { selectedOffer = supplierProductRepository.findDetailedById(UUID.fromString(requestedOfferId)).orElse(null); }
        catch (IllegalArgumentException ignored) { /* Legacy Product ID request */ }
        Product product = selectedOffer == null ? requireProduct(requestedOfferId) : selectedOffer.getProduct();
        String productId = product.getProductID();
        if (!Boolean.TRUE.equals(product.getActive())) {
            throw new BusinessException("Product is not available", HttpStatus.BAD_REQUEST);
        }
        SupplierResaleCatalogFlag flag = selectedOffer == null ? flagRepository.findByProductId(productId)
                .orElseThrow(() -> new BusinessException("Product is not available for resale", HttpStatus.BAD_REQUEST)) : null;
        if (selectedOffer == null && (!Boolean.TRUE.equals(flag.getResaleEnabled()) || !Boolean.TRUE.equals(flag.getSupplierProductApproved())
                || flag.getWholesalePrice() == null || !Objects.equals(flag.getSupplierUserId(), product.getSupplierUserId()))) {
            throw new BusinessException("Product is not available for resale", HttpStatus.BAD_REQUEST);
        }
        UUID owningSupplierId = selectedOffer == null ? flag.getSupplierUserId() : selectedOffer.getSupplier().getId();
        int offerStock = selectedOffer == null ? (product.getStockQuantity() == null ? 0 : product.getStockQuantity())
                : Math.max(0, selectedOffer.getStockQuantity() - selectedOffer.getReservedQuantity());
        int offerMoq = selectedOffer == null ? flag.getMinimumOrderQuantity() : selectedOffer.getMinimumOrderQuantity();
        if (selectedOffer != null && (!Boolean.TRUE.equals(selectedOffer.getApproved()) || !Boolean.TRUE.equals(selectedOffer.getAvailable()) || !Boolean.TRUE.equals(selectedOffer.getAllowResale()) || selectedOffer.getWholesalePrice() == null)) {
            throw new BusinessException("Product is not available for resale", HttpStatus.BAD_REQUEST);
        }
        if (offerStock < offerMoq) {
            throw new BusinessException("Supplier product is currently unavailable or below MOQ", HttpStatus.CONFLICT);
        }

        boolean pending = selectedOffer == null
                ? requestRepository.existsBySellerIdAndSupplierProductIdAndStatus(seller.getId(), productId, SellerResaleRequestStatus.PENDING)
                : requestRepository.existsBySellerIdAndSupplierOfferIdAndStatus(seller.getId(), selectedOffer.getId(), SellerResaleRequestStatus.PENDING);
        if (pending) {
            throw new BusinessException("You already have a pending request for this product", HttpStatus.CONFLICT);
        }
        boolean alreadyAuthorized = selectedOffer == null
                ? authorizationRepository.existsBySellerIdAndSupplierProductIdAndActiveTrue(seller.getId(), productId)
                : authorizationRepository.existsBySellerIdAndSupplierOfferIdAndActiveTrue(seller.getId(), selectedOffer.getId());
        if (alreadyAuthorized) {
            throw new BusinessException("You already have an active resale authorization for this product", HttpStatus.CONFLICT);
        }

        User sellerUser = userRepository.findById(seller.getId())
                .orElseThrow(() -> new BusinessException("User not found", HttpStatus.NOT_FOUND));

        SellerResaleRequest request = SellerResaleRequest.builder()
                .supplierProductId(productId)
                .supplierOffer(selectedOffer)
                .seller(sellerUser)
                .supplierUserId(owningSupplierId)
                .proposalMessage(trimToNull(dto.getProposalMessage()))
                .proposedRetailPrice(dto.getProposedRetailPrice())
                .status(SellerResaleRequestStatus.PENDING)
                .build();
        SellerResaleRequest saved = requestRepository.save(request);

        String dedupeKey = "resale_req_sub:" + saved.getId();
        if (owningSupplierId != null) {
            notificationService.createForUser(owningSupplierId, dedupeKey + ":sup",
                    "resale", "New Resale Request",
                    displayName(sellerUser) + " requested permission to resell " + product.getProductName(),
                    "/supplier/resale-requests/" + saved.getId(), saved.getId().toString());

            sendEmailSafely(() -> {
                User supplierUser = userRepository.findById(owningSupplierId).orElse(null);
                if (supplierUser != null && StringUtils.hasText(supplierUser.getEmail())) {
                    String html = emailTemplateService.generateResaleRequestSubmittedEmail(
                            displayName(supplierUser),
                            displayName(sellerUser),
                            sellerUser.getEmail(),
                            product.getProductName(),
                            saved.getProposalMessage()
                    );
                    emailService.sendEmail(supplierUser.getEmail(), "New resale request for " + product.getProductName(), html);
                }
            }, "resale request submission email");
        }

        notificationService.notifyAdmins(dedupeKey + ":adm", "resale",
                "New Resale Request Submitted",
                displayName(sellerUser) + " requested to resell " + product.getProductName(),
                "/admin", saved.getId().toString());

        adminAuditLogger.log("RESALE_REQUEST_SUBMITTED", seller.getEmail(),
                Map.of("requestId", saved.getId().toString(), "productId", productId));

        ResaleRequestResponseDto result = ResaleRequestResponseDto.fromEntity(saved);
        result.setSupplierProductName(product.getProductName());
        result.setSupplierProductImage(product.getFrontImg());
        result.setSupplierProductPrice(product.getProductPrice());
        return result;
    }

    @Override
    @Transactional(readOnly = true)
    public Page<ResaleRequestResponseDto> listMyRequests(String status, User seller, Pageable pageable) {
        requireSeller(seller);
        Page<SellerResaleRequest> page;
        if (StringUtils.hasText(status)) {
            page = requestRepository.findBySellerIdAndStatusOrderByCreatedAtDesc(
                    seller.getId(), parseStatus(status), pageable);
        } else {
            page = requestRepository.findBySellerIdOrderByCreatedAtDesc(seller.getId(), pageable);
        }
        return page.map(r -> enrichRequest(ResaleRequestResponseDto.fromEntity(r), r));
    }

    @Override
    @Transactional(readOnly = true)
    public ResaleRequestResponseDto getRequest(UUID requestId, User actor) {
        SellerResaleRequest r = requestRepository.findById(requestId)
                .orElseThrow(() -> new BusinessException("Request not found", HttpStatus.NOT_FOUND));
        boolean isSeller = r.getSeller() != null && r.getSeller().getId().equals(actor.getId());
        boolean isSupplier = r.getSupplierUserId() != null && r.getSupplierUserId().equals(actor.getId());
        boolean isAdmin = hasRole(actor, "ROLE_ADMIN");
        if (!isSeller && !isSupplier && !isAdmin) {
            throw new BusinessException("Access denied", HttpStatus.FORBIDDEN);
        }
        return enrichRequest(ResaleRequestResponseDto.fromEntity(r), r);
    }

    @Override
    @Transactional
    public ResaleRequestResponseDto cancelRequest(UUID requestId, String reason, User seller) {
        requireSeller(seller);
        SellerResaleRequest r = requestRepository.findById(requestId)
                .orElseThrow(() -> new BusinessException("Request not found", HttpStatus.NOT_FOUND));
        if (!r.getSeller().getId().equals(seller.getId())) {
            throw new BusinessException("Access denied", HttpStatus.FORBIDDEN);
        }
        if (r.getStatus() != SellerResaleRequestStatus.PENDING) {
            throw new BusinessException("Only PENDING requests can be cancelled", HttpStatus.BAD_REQUEST);
        }
        r.setStatus(SellerResaleRequestStatus.CANCELLED);
        r.setCancelledAt(LocalDateTime.now());
        r.setCancelReason(trimToNull(reason));
        SellerResaleRequest saved = requestRepository.save(r);

        Product product = productRepository.findByProductID(r.getSupplierProductId()).orElse(null);
        String productName = product != null ? product.getProductName() : r.getSupplierProductId();

        if (r.getSupplierUserId() != null) {
            notificationService.createForUser(r.getSupplierUserId(), "resale_req_canc:" + r.getId(),
                    "resale", "Resale Request Cancelled",
                    displayName(seller) + " cancelled their resale request for " + productName,
                    "/supplier/resale-requests", r.getId().toString());

            sendEmailSafely(() -> {
                User supplierUser = userRepository.findById(r.getSupplierUserId()).orElse(null);
                if (supplierUser != null && StringUtils.hasText(supplierUser.getEmail())) {
                    String html = emailTemplateService.generateResaleRequestCancelledEmail(
                            displayName(supplierUser), displayName(seller), productName, reason);
                    emailService.sendEmail(supplierUser.getEmail(), "Resale request cancelled", html);
                }
            }, "resale cancellation email");
        }

        return enrichRequest(ResaleRequestResponseDto.fromEntity(saved), saved);
    }

    // =====================================================
    // Supplier: Review Requests
    // =====================================================

    @Override
    @Transactional(readOnly = true)
    public Page<ResaleRequestResponseDto> listIncomingRequests(String status, String productId, User supplier, Pageable pageable) {
        requireSupplier(supplier);
        Page<SellerResaleRequest> page;
        if (StringUtils.hasText(status)) {
            page = requestRepository.findBySupplierUserIdAndStatusOrderByCreatedAtDesc(
                    supplier.getId(), parseStatus(status), pageable);
        } else {
            page = requestRepository.findBySupplierUserIdOrderByCreatedAtDesc(supplier.getId(), pageable);
        }
        return page.map(r -> enrichRequest(ResaleRequestResponseDto.fromEntity(r), r));
    }

    @Override
    @Transactional
    public ResaleRequestResponseDto acceptRequest(UUID requestId, String note, User supplier) {
        return acceptRequest(requestId, note, null, supplier);
    }

    @Override
    @Transactional
    public ResaleRequestResponseDto acceptRequest(UUID requestId, String note, Integer requestedAllocation, User supplier) {
        boolean adminReviewer = hasRole(supplier, "ROLE_ADMIN");
        if (!adminReviewer) requireSupplier(supplier);
        SellerResaleRequest r = getPendingRequest(requestId);
        if (!adminReviewer && !r.getSupplierUserId().equals(supplier.getId())) {
            throw new BusinessException("Access denied", HttpStatus.FORBIDDEN);
        }

        User supplierUser = userRepository.findById(supplier.getId())
                .orElseThrow(() -> new BusinessException("User not found", HttpStatus.NOT_FOUND));

        int initialAllocation = requestedAllocation == null ? 0 : requestedAllocation;
        if (requestedAllocation != null && requestedAllocation < 0)
            throw new BusinessException("Initial allocation cannot be negative", HttpStatus.BAD_REQUEST);
        SupplierProduct approvedOffer = r.getSupplierOffer();
        if (approvedOffer != null) {
            Integer supplierAvailable = jdbcTemplate.queryForObject("select stock_quantity-reserved_quantity from supplier_products where id=? for update", Integer.class, approvedOffer.getId());
            int minimum = Math.max(1, approvedOffer.getMinimumOrderQuantity());
            if (requestedAllocation == null) initialAllocation = minimum;
            if (initialAllocation < minimum)
                throw new BusinessException("Initial allocation must meet Supplier MOQ (" + minimum + ")", HttpStatus.BAD_REQUEST);
            long allocated = Optional.ofNullable(allocationRepository.sumRemainingForOffer(approvedOffer.getId())).orElse(0L);
            long approvedButUnlisted = Optional.ofNullable(authorizationRepository.sumUnlistedApprovedAllocationsForOffer(r.getSupplierUserId(), approvedOffer.getId())).orElse(0L);
            if ((long) allocated + approvedButUnlisted + initialAllocation > (supplierAvailable == null ? 0 : supplierAvailable))
                throw new BusinessException("Initial allocation exceeds available unallocated inventory", HttpStatus.CONFLICT);
        }

        r.setStatus(SellerResaleRequestStatus.APPROVED);
        r.setReviewer(supplierUser);
        r.setReviewerNote(trimToNull(note));
        r.setReviewedAt(LocalDateTime.now());
        SellerResaleRequest saved = requestRepository.save(r);

        SellerResaleAuthorization auth = SellerResaleAuthorization.builder()
                .resaleRequest(saved)
                .supplierProductId(saved.getSupplierProductId())
                .supplierOffer(saved.getSupplierOffer())
                .seller(saved.getSeller())
                .supplierUserId(saved.getSupplierUserId())
                .initialAllocationQuantity(initialAllocation)
                .grantedBy(supplierUser)
                .grantedAt(LocalDateTime.now())
                .active(true)
                .build();
        authorizationRepository.save(auth);

        Product product = productRepository.findByProductID(saved.getSupplierProductId()).orElse(null);
        String productName = product == null ? saved.getSupplierProductId() : product.getProductName();

        notificationService.createForUser(saved.getSeller().getId(), "resale_acc:" + saved.getId(),
                "resale", "Resale Request Approved! 🎉",
                "Your request to resell \"" + productName + "\" has been approved with an initial allocation of " + initialAllocation + " units.",
                "/seller/resale-requests/" + saved.getId(), saved.getId().toString());

        sendEmailSafely(() -> {
            if (StringUtils.hasText(saved.getSeller().getEmail())) {
                String html = emailTemplateService.generateResaleRequestAcceptedEmail(
                        displayName(saved.getSeller()),
                        displayName(supplierUser),
                        productName,
                        note
                );
                emailService.sendEmail(saved.getSeller().getEmail(), "Your resale request was approved!", html);
            }
        }, "resale acceptance email");

        adminAuditLogger.log("RESALE_REQUEST_ACCEPTED", supplier.getEmail(),
                Map.of("requestId", requestId.toString(), "productId", saved.getSupplierProductId()));

        ResaleRequestResponseDto response = enrichRequest(ResaleRequestResponseDto.fromEntity(saved), saved);
        response.setInitialAllocationQuantity(initialAllocation);
        return response;
    }

    @Override
    @Transactional
    public ResaleRequestResponseDto rejectRequest(UUID requestId, String note, User supplier) {
        boolean adminReviewer = hasRole(supplier, "ROLE_ADMIN");
        if (!adminReviewer) requireSupplier(supplier);
        if (!StringUtils.hasText(note)) {
            throw new BusinessException("A rejection reason is required", HttpStatus.BAD_REQUEST);
        }
        SellerResaleRequest r = getPendingRequest(requestId);
        if (!adminReviewer && !r.getSupplierUserId().equals(supplier.getId())) {
            throw new BusinessException("Access denied", HttpStatus.FORBIDDEN);
        }

        User supplierUser = userRepository.findById(supplier.getId())
                .orElseThrow(() -> new BusinessException("User not found", HttpStatus.NOT_FOUND));

        r.setStatus(SellerResaleRequestStatus.REJECTED);
        r.setReviewer(supplierUser);
        r.setReviewerNote(note.trim());
        r.setReviewedAt(LocalDateTime.now());
        SellerResaleRequest saved = requestRepository.save(r);

        Product product = productRepository.findByProductID(saved.getSupplierProductId()).orElse(null);
        String productName = product == null ? saved.getSupplierProductId() : product.getProductName();

        notificationService.createForUser(saved.getSeller().getId(), "resale_rej:" + saved.getId(),
                "resale", "Resale Request Update",
                "Your request to resell \"" + productName + "\" was not approved.",
                "/seller/resale-requests/" + saved.getId(), saved.getId().toString());

        sendEmailSafely(() -> {
            if (StringUtils.hasText(saved.getSeller().getEmail())) {
                String html = emailTemplateService.generateResaleRequestRejectedEmail(
                        displayName(saved.getSeller()),
                        displayName(supplierUser),
                        productName,
                        note
                );
                emailService.sendEmail(saved.getSeller().getEmail(), "Update on your resale request", html);
            }
        }, "resale rejection email");

        adminAuditLogger.log("RESALE_REQUEST_REJECTED", supplier.getEmail(),
                Map.of("requestId", requestId.toString()));

        return enrichRequest(ResaleRequestResponseDto.fromEntity(saved), saved);
    }

    @Override
    @Transactional(readOnly = true)
    public SellerProfileDto getSellerProfileForSupplier(UUID sellerId, User supplier) {
        requireSupplier(supplier);
        User seller = userRepository.findById(sellerId)
                .orElseThrow(() -> new BusinessException("Seller not found", HttpStatus.NOT_FOUND));
        if (!hasRole(seller, "ROLE_SELLER")) {
            throw new BusinessException("User is not a seller", HttpStatus.NOT_FOUND);
        }

        Optional<SellerAccessRequest> optSar = sellerAccessRequestRepository.findFirstByRequestedByIdOrderByCreatedAtDesc(sellerId);
        String storeName = optSar.map(SellerAccessRequest::getBusinessName).orElse(displayName(seller));
        String desc = optSar.map(SellerAccessRequest::getNote).orElse(null);
        String website = optSar.map(SellerAccessRequest::getWebsiteUrl).orElse(null);

        List<Product> sellerProducts = productRepository.findBySellerUserIdOrderByIdAsc(sellerId);
        int activeListings = (int) sellerProducts.stream().filter(p -> Boolean.TRUE.equals(p.getActive())).count();

        List<SellerResaleAuthorization> authorizations = authorizationRepository.findBySellerIdOrderByGrantedAtDesc(sellerId, Pageable.unpaged()).getContent();
        int activePartnerships = (int) authorizations.stream().filter(a -> Boolean.TRUE.equals(a.getActive())).count();

        List<SellerResaleRequest> allRequests = requestRepository.findBySellerIdOrderByCreatedAtDesc(sellerId, Pageable.unpaged()).getContent();
        int totalRequests = allRequests.size();

        // Requests specific to this supplier
        List<ResaleRequestResponseDto> requestsWithSupplier = allRequests.stream()
                .filter(r -> supplier.getId().equals(r.getSupplierUserId()))
                .map(r -> enrichRequest(ResaleRequestResponseDto.fromEntity(r), r))
                .toList();

        List<ResaleAuthorizationDto> activeAuths = authorizations.stream()
                .filter(a -> Boolean.TRUE.equals(a.getActive()) && supplier.getId().equals(a.getSupplierUserId()))
                .map(a -> enrichAuthorization(ResaleAuthorizationDto.fromEntity(a), a))
                .toList();

        return SellerProfileDto.builder()
                .sellerId(sellerId)
                .storeName(storeName)
                .businessDescription(desc)
                .websiteUrl(website)
                .memberSince(seller.getCreatedAt())
                .emailVerified(seller.isEmailVerified())
                .activeListingCount(activeListings)
                .activePartnershipCount(activePartnerships)
                .totalRequestsSubmitted(totalRequests)
                .previousRequests(requestsWithSupplier)
                .activePartnerships(activeAuths)
                .build();
    }

    // =====================================================
    // Authorizations
    // =====================================================

    @Override
    @Transactional(readOnly = true)
    public Page<ResaleAuthorizationDto> listSellerAuthorizations(boolean activeOnly, User seller, Pageable pageable) {
        requireSeller(seller);
        Page<SellerResaleAuthorization> page = activeOnly
                ? authorizationRepository.findBySellerIdAndActiveTrueOrderByGrantedAtDesc(seller.getId(), pageable)
                : authorizationRepository.findBySellerIdOrderByGrantedAtDesc(seller.getId(), pageable);
        return page.map(a -> enrichAuthorization(ResaleAuthorizationDto.fromEntity(a), a));
    }

    @Override
    @Transactional(readOnly = true)
    public Page<ResaleAuthorizationDto> listSupplierAuthorizations(boolean activeOnly, User supplier, Pageable pageable) {
        requireSupplier(supplier);
        Page<SellerResaleAuthorization> page = activeOnly
                ? authorizationRepository.findBySupplierUserIdAndActiveTrueOrderByGrantedAtDesc(supplier.getId(), pageable)
                : authorizationRepository.findBySupplierUserIdOrderByGrantedAtDesc(supplier.getId(), pageable);
        return page.map(a -> enrichAuthorization(ResaleAuthorizationDto.fromEntity(a), a));
    }

    @Override
    @Transactional
    public ResaleAuthorizationDto revokeAuthorization(UUID authorizationId, String reason, User supplier) {
        requireSupplier(supplier);
        if (!StringUtils.hasText(reason)) {
            throw new BusinessException("A revocation reason is required", HttpStatus.BAD_REQUEST);
        }
        SellerResaleAuthorization auth = authorizationRepository.findById(authorizationId)
                .orElseThrow(() -> new BusinessException("Authorization not found", HttpStatus.NOT_FOUND));
        if (!auth.getSupplierUserId().equals(supplier.getId())) {
            throw new BusinessException("Access denied", HttpStatus.FORBIDDEN);
        }
        if (!Boolean.TRUE.equals(auth.getActive())) {
            throw new BusinessException("Authorization is already revoked", HttpStatus.BAD_REQUEST);
        }

        User supplierUser = userRepository.findById(supplier.getId()).orElseThrow();
        auth.setActive(false);
        auth.setRevokedAt(LocalDateTime.now());
        auth.setRevokedBy(supplierUser);
        auth.setRevokeReason(reason.trim());

        listingRepository.findByAuthorizationIdOrderByCreatedAtDesc(authorizationId, Pageable.unpaged())
                .forEach(listing -> {
                    listing.setActive(false);
                    listingRepository.save(listing);
                });

        SellerResaleAuthorization saved = authorizationRepository.save(auth);

        Product product = productRepository.findByProductID(auth.getSupplierProductId()).orElse(null);
        String productName = product == null ? auth.getSupplierProductId() : product.getProductName();

        notificationService.createForUser(auth.getSeller().getId(), "resale_rev:" + authorizationId,
                "resale", "Resale Authorization Revoked",
                "Your authorization to resell \"" + productName + "\" has been revoked.",
                "/seller/partnerships", authorizationId.toString());

        sendEmailSafely(() -> {
            if (StringUtils.hasText(auth.getSeller().getEmail())) {
                String html = emailTemplateService.generateResaleAuthorizationRevokedEmail(
                        displayName(auth.getSeller()),
                        displayName(supplierUser),
                        productName,
                        reason
                );
                emailService.sendEmail(auth.getSeller().getEmail(), "Resale authorization revoked", html);
            }
        }, "revocation email");

        adminAuditLogger.log("RESALE_AUTHORIZATION_REVOKED", supplier.getEmail(),
                Map.of("authorizationId", authorizationId.toString()));

        return enrichAuthorization(ResaleAuthorizationDto.fromEntity(saved), saved);
    }

    // =====================================================
    // Seller Listings
    // =====================================================

    @Override
    @Transactional
    public SellerProductListingDto createListing(CreateListingDto dto, User seller) {
        requireSeller(seller);
        if (dto == null || !StringUtils.hasText(dto.getAuthorizationId())) {
            throw new BusinessException("Authorization ID is required", HttpStatus.BAD_REQUEST);
        }
        UUID authId;
        try {
            authId = UUID.fromString(dto.getAuthorizationId().trim());
        } catch (IllegalArgumentException e) {
            throw new BusinessException("Invalid authorization ID", HttpStatus.BAD_REQUEST);
        }

        SellerResaleAuthorization auth = authorizationRepository.findById(authId)
                .orElseThrow(() -> new BusinessException("Authorization not found", HttpStatus.NOT_FOUND));
        if (!auth.getSeller().getId().equals(seller.getId())) {
            throw new BusinessException("Access denied", HttpStatus.FORBIDDEN);
        }
        if (!Boolean.TRUE.equals(auth.getActive())) {
            throw new BusinessException("Authorization is not active. Cannot create listing.", HttpStatus.BAD_REQUEST);
        }
        Product sourceProduct = requireProduct(auth.getSupplierProductId());
        if (auth.getSupplierOffer() != null) {
            SupplierProduct offer = supplierProductRepository.findDetailedById(auth.getSupplierOffer().getId())
                    .orElseThrow(() -> new BusinessException("Supplier offer is unavailable", HttpStatus.CONFLICT));
            if (!offer.getSupplier().getId().equals(auth.getSupplierUserId()) || !Boolean.TRUE.equals(offer.getApproved())
                    || !Boolean.TRUE.equals(offer.getAvailable()) || !Boolean.TRUE.equals(offer.getAllowResale())
                    || offer.getStockQuantity() - offer.getReservedQuantity() < offer.getMinimumOrderQuantity())
                throw new BusinessException("Supplier offer is unavailable or below MOQ", HttpStatus.CONFLICT);
        } else {
            SupplierResaleCatalogFlag offer = flagRepository.findByProductId(auth.getSupplierProductId())
                    .orElseThrow(() -> new BusinessException("Supplier offer is unavailable", HttpStatus.CONFLICT));
            if (!Boolean.TRUE.equals(offer.getResaleEnabled()) || !Boolean.TRUE.equals(offer.getSupplierProductApproved())
                    || offer.getWholesalePrice() == null || sourceProduct.getStockQuantity() == null
                    || sourceProduct.getStockQuantity() < offer.getMinimumOrderQuantity())
                throw new BusinessException("Supplier offer is unavailable or below MOQ", HttpStatus.CONFLICT);
        }
        boolean existsListing = auth.getSupplierOffer() == null
                ? listingRepository.existsBySellerIdAndSupplierProductId(seller.getId(), auth.getSupplierProductId())
                : listingRepository.existsBySellerIdAndSupplierOfferId(seller.getId(), auth.getSupplierOffer().getId());
        if (existsListing) {
            throw new BusinessException("You already have a listing for this product", HttpStatus.CONFLICT);
        }

        User sellerUser = userRepository.findById(seller.getId()).orElseThrow();
        SellerProductListing listing = SellerProductListing.builder()
                .authorization(auth)
                .supplierProductId(auth.getSupplierProductId())
                .supplierOffer(auth.getSupplierOffer())
                .seller(sellerUser)
                .supplierUserId(auth.getSupplierUserId())
                .customTitle(trimToNull(dto.getCustomTitle()))
                .retailPrice(dto.getRetailPrice())
                .active(true)
                .build();
        SellerProductListing saved = listingRepository.saveAndFlush(listing);
        if (saved.getSupplierOffer() != null) {
            Integer supplierAvailable = jdbcTemplate.queryForObject("select stock_quantity-reserved_quantity from supplier_products where id=? for update", Integer.class, saved.getSupplierOffer().getId());
            int initialAllocation = auth.getInitialAllocationQuantity() > 0
                    ? auth.getInitialAllocationQuantity() : Math.max(saved.getSupplierOffer().getMinimumOrderQuantity(), 1);
            long committed = Optional.ofNullable(allocationRepository.sumRemainingForOffer(saved.getSupplierOffer().getId())).orElse(0L);
            long otherUnlisted = Optional.ofNullable(authorizationRepository.sumUnlistedApprovedAllocationsForOfferExcluding(auth.getSupplierUserId(), saved.getSupplierOffer().getId(), auth.getId())).orElse(0L);
            if (committed + otherUnlisted + initialAllocation > (supplierAvailable == null ? 0 : supplierAvailable)) {
                throw new BusinessException("Supplier has insufficient unallocated inventory to activate this listing", HttpStatus.CONFLICT);
            }
            SellerProductAllocation allocation = allocationRepository.saveAndFlush(SellerProductAllocation.builder().listing(saved).supplierOffer(saved.getSupplierOffer())
                    .sellerUserId(saved.getSeller().getId()).supplierUserId(saved.getSupplierUserId())
                    .allocatedQuantity(initialAllocation).soldQuantity(0).reservedQuantity(0).status("ACTIVE").build());
            jdbcTemplate.update("insert into seller_product_allocation_audit(allocation_id, previous_quantity, new_quantity, supplier_user_id, reason) values(?,?,?,?,?)", allocation.getId(), 0, initialAllocation, saved.getSupplierUserId(), "Initial allocation on listing creation");
        }

        adminAuditLogger.log("SELLER_LISTING_CREATED", seller.getEmail(),
                Map.of("listingId", saved.getId().toString(), "productId", auth.getSupplierProductId()));

        return enrichListing(SellerProductListingDto.fromEntity(saved), saved);
    }

    @Override
    @Transactional(readOnly = true)
    public Page<SellerProductListingDto> listMyListings(User seller, Pageable pageable) {
        requireSeller(seller);
        return listingRepository.findBySellerIdOrderByCreatedAtDesc(seller.getId(), pageable)
                .map(l -> enrichListing(SellerProductListingDto.fromEntity(l), l));
    }

    @Override
    @Transactional
    public SellerProductListingDto updateListing(UUID listingId, UpdateListingDto dto, User seller) {
        requireSeller(seller);
        SellerProductListing listing = listingRepository.findById(listingId)
                .orElseThrow(() -> new BusinessException("Listing not found", HttpStatus.NOT_FOUND));
        if (!listing.getSeller().getId().equals(seller.getId())) throw new BusinessException("Access denied", HttpStatus.FORBIDDEN);
        if (dto.getRetailPrice() != null) listing.setRetailPrice(dto.getRetailPrice());
        if (dto.getCustomTitle() != null) listing.setCustomTitle(trimToNull(dto.getCustomTitle()));
        if (Boolean.TRUE.equals(dto.getActive())) {
            if (!Boolean.TRUE.equals(listing.getAuthorization().getActive())) throw new BusinessException("Partnership is inactive", HttpStatus.CONFLICT);
            Product product = requireProduct(listing.getSupplierProductId());
            if (listing.getSupplierOffer() != null) {
                SupplierProduct offer = supplierProductRepository.findDetailedById(listing.getSupplierOffer().getId())
                        .orElseThrow(() -> new BusinessException("Supplier offer is unavailable", HttpStatus.CONFLICT));
                if (!offer.getSupplier().getId().equals(listing.getSupplierUserId()) || !Boolean.TRUE.equals(offer.getApproved())
                        || !Boolean.TRUE.equals(offer.getAllowResale())
                        || !Boolean.TRUE.equals(offer.getAvailable()) || offer.getStockQuantity() - offer.getReservedQuantity() < offer.getMinimumOrderQuantity())
                    throw new BusinessException("Supplier offer is unavailable or below MOQ", HttpStatus.CONFLICT);
            } else {
                SupplierResaleCatalogFlag flag = flagRepository.findByProductId(listing.getSupplierProductId())
                        .orElseThrow(() -> new BusinessException("Supplier offer is unavailable", HttpStatus.CONFLICT));
                if (!Boolean.TRUE.equals(flag.getResaleEnabled()) || !Boolean.TRUE.equals(flag.getSupplierProductApproved()) || flag.getWholesalePrice() == null
                        || product.getStockQuantity() == null || product.getStockQuantity() < flag.getMinimumOrderQuantity())
                    throw new BusinessException("Supplier offer is unavailable or below MOQ", HttpStatus.CONFLICT);
            }
            listing.setActive(true);
        } else if (Boolean.FALSE.equals(dto.getActive())) {
            listing.setActive(false);
        }
        return enrichListing(SellerProductListingDto.fromEntity(listingRepository.save(listing)), listing);
    }

    // =====================================================
    // Admin
    // =====================================================

    @Override
    @Transactional(readOnly = true)
    public Page<ResaleRequestResponseDto> adminListAllRequests(String status, Pageable pageable) {
        Page<SellerResaleRequest> page;
        if (StringUtils.hasText(status)) {
            page = requestRepository.findAllByStatus(parseStatus(status), pageable);
        } else {
            page = requestRepository.findAllOrderByCreatedAtDesc(pageable);
        }
        return page.map(r -> enrichRequest(ResaleRequestResponseDto.fromEntity(r), r));
    }

    @Override
    @Transactional(readOnly = true)
    public Page<ResaleAuthorizationDto> adminListAllAuthorizations(Pageable pageable) {
        return authorizationRepository.findAllOrderByGrantedAtDesc(pageable)
                .map(a -> enrichAuthorization(ResaleAuthorizationDto.fromEntity(a), a));
    }

    // =====================================================
    // Public Profile
    // =====================================================

    @Override
    @Transactional(readOnly = true)
    public SupplierPublicProfileDto getSupplierPublicProfile(UUID supplierId) {
        User supplier = userRepository.findById(supplierId)
                .orElseThrow(() -> new BusinessException("Supplier not found", HttpStatus.NOT_FOUND));
        if (!hasRole(supplier, "ROLE_SUPPLIER")) {
            throw new BusinessException("Not a supplier", HttpStatus.NOT_FOUND);
        }
        List<SupplierResaleCatalogFlag> flags = flagRepository.findBySupplierUserIdOrderByCreatedAtDesc(supplierId);
        long enabledCount = flags.stream().filter(f -> Boolean.TRUE.equals(f.getResaleEnabled())).count();
        List<Product> products = productRepository.findBySupplierUserIdOrderByIdAsc(supplierId);
        long activeCount = products.stream().filter(p -> Boolean.TRUE.equals(p.getActive())).count();

        return SupplierPublicProfileDto.builder()
                .supplierId(supplierId)
                .displayName(displayName(supplier))
                .emailVerified(supplier.isEmailVerified())
                .memberSince(supplier.getCreatedAt())
                .activeProductCount((int) activeCount)
                .resaleEnabledProductCount((int) enabledCount)
                .build();
    }

    // =====================================================
    // Helpers
    // =====================================================

    private Product requireProduct(String productId) {
        return productRepository.findByProductID(productId)
                .orElseThrow(() -> new BusinessException("Product not found", HttpStatus.NOT_FOUND));
    }

    private SellerResaleRequest getPendingRequest(UUID requestId) {
        SellerResaleRequest r = requestRepository.findById(requestId)
                .orElseThrow(() -> new BusinessException("Request not found", HttpStatus.NOT_FOUND));
        if (r.getStatus() != SellerResaleRequestStatus.PENDING) {
            throw new BusinessException("Request is not in PENDING status", HttpStatus.BAD_REQUEST);
        }
        return r;
    }

    private SellerResaleRequestStatus parseStatus(String s) {
        try {
            return SellerResaleRequestStatus.valueOf(s.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException e) {
            throw new BusinessException("Invalid status: " + s, HttpStatus.BAD_REQUEST);
        }
    }

    private void requireSeller(User user) {
        if (user == null || !hasRole(user, "ROLE_SELLER")) {
            throw new BusinessException("Seller access required", HttpStatus.FORBIDDEN);
        }
    }

    private void requireSupplier(User user) {
        if (user == null || !hasRole(user, "ROLE_SUPPLIER")) {
            throw new BusinessException("Supplier access required", HttpStatus.FORBIDDEN);
        }
    }

    private boolean hasRole(User user, String role) {
        return user != null && user.getRoles() != null
                && user.getRoles().stream().anyMatch(r -> role.equalsIgnoreCase(r.getName())
                || role.equalsIgnoreCase("ROLE_" + r.getName()));
    }

    private String displayName(User user) {
        if (user == null) return "Unknown";
        String full = ((user.getFirstName() == null ? "" : user.getFirstName().trim())
                + " " + (user.getLastName() == null ? "" : user.getLastName().trim())).trim();
        return full.isBlank() ? user.getEmail() : full;
    }

    private String trimToNull(String s) {
        return (s == null || s.isBlank()) ? null : s.trim();
    }

    private String normalizeSearch(String value) {
        if (!StringUtils.hasText(value)) return "";
        String normalized = java.text.Normalizer.normalize(value, java.text.Normalizer.Form.NFD)
                .replaceAll("\\p{M}+", "").toLowerCase(Locale.ROOT);
        return normalized.trim();
    }

    private void sendEmailSafely(Runnable task, String label) {
        try {
            task.run();
        } catch (Exception e) {
            log.error("Failed to send {}: {}", label, e.getMessage());
        }
    }

    private ResaleRequestResponseDto enrichRequest(ResaleRequestResponseDto dto, SellerResaleRequest r) {
        authorizationRepository.findByResaleRequestId(r.getId()).ifPresent(a -> dto.setInitialAllocationQuantity(a.getInitialAllocationQuantity()));
        if (r.getSupplierOffer() != null) {
            dto.setMinimumOrderQuantity(r.getSupplierOffer().getMinimumOrderQuantity());
            long allocated = Optional.ofNullable(allocationRepository.sumAllocatedForOffer(r.getSupplierOffer().getId())).orElse(0L);
            long committed = Optional.ofNullable(authorizationRepository.sumUnlistedApprovedAllocationsForOffer(r.getSupplierUserId(), r.getSupplierOffer().getId())).orElse(0L);
            dto.setAvailableInventory((int) Math.max(0, r.getSupplierOffer().getStockQuantity() - r.getSupplierOffer().getReservedQuantity() - allocated - committed));
        }
        productRepository.findByProductID(r.getSupplierProductId())
                .ifPresent(p -> {
                    dto.setSupplierProductName(p.getProductName());
                    dto.setSupplierProductImage(p.getFrontImg());
                    dto.setSupplierProductPrice(p.getProductPrice());
                });
        userRepository.findById(r.getSupplierUserId())
                .ifPresent(u -> dto.setSupplierDisplayName(displayName(u)));
        return dto;
    }

    private ResaleAuthorizationDto enrichAuthorization(ResaleAuthorizationDto dto, SellerResaleAuthorization a) {
        productRepository.findByProductID(a.getSupplierProductId())
                .ifPresent(p -> {
                    dto.setSupplierProductName(p.getProductName());
                    dto.setSupplierProductImage(p.getFrontImg());
                    dto.setSupplierProductPrice(p.getProductPrice());
                });
        userRepository.findById(a.getSupplierUserId())
                .ifPresent(u -> dto.setSupplierDisplayName(displayName(u)));
        return dto;
    }

    private SellerProductListingDto enrichListing(SellerProductListingDto dto, SellerProductListing l) {
        allocationRepository.findByListingId(l.getId()).ifPresent(a -> {
            dto.setAllocatedQuantity(a.getAllocatedQuantity());
            dto.setSoldQuantity(a.getSoldQuantity());
            dto.setReservedQuantity(a.getReservedQuantity());
            dto.setRemainingQuantity(a.remaining());
        });
        productRepository.findByProductID(l.getSupplierProductId()).ifPresent(p -> {
            dto.setSupplierProductName(p.getProductName());
            dto.setSupplierProductImage(p.getFrontImg());
        });
        userRepository.findById(l.getSupplierUserId()).ifPresent(u -> dto.setSupplierDisplayName(displayName(u)));
        return dto;
    }
}
