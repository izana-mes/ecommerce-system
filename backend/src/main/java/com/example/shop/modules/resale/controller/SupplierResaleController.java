package com.example.shop.modules.resale.controller;

import com.example.shop.modules.resale.dto.*;
import com.example.shop.modules.resale.service.ResaleService;
import com.example.shop.modules.user.entity.User;
import com.example.shop.modules.user.entity.SupplierOperatingMode;
import com.example.shop.modules.user.repository.UserRepository;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/supplier/resale")
@PreAuthorize("hasRole('SUPPLIER')")
@RequiredArgsConstructor
public class SupplierResaleController {

    private final ResaleService resaleService;
    private final UserRepository userRepository;

    public record OperatingModeRequest(SupplierOperatingMode operatingMode) { }

    @GetMapping("/operating-mode")
    public ResponseEntity<OperatingModeRequest> getOperatingMode(@AuthenticationPrincipal User actor) {
        return ResponseEntity.ok(new OperatingModeRequest(actor.getSupplierOperatingMode()));
    }

    @PutMapping("/operating-mode")
    public ResponseEntity<OperatingModeRequest> setOperatingMode(@RequestBody OperatingModeRequest body,
                                                                  @AuthenticationPrincipal User actor) {
        if (body == null || body.operatingMode() == null) throw new IllegalArgumentException("operatingMode is required");
        actor.setSupplierOperatingMode(body.operatingMode());
        userRepository.save(actor);
        return ResponseEntity.ok(body);
    }

    // --- Catalog flag management ---

    @GetMapping("/catalog-flags")
    public ResponseEntity<List<SupplierResaleCatalogFlagDto>> listCatalogFlags(@AuthenticationPrincipal User actor) {
        return ResponseEntity.ok(resaleService.listSupplierCatalogFlags(actor));
    }

    @PutMapping("/catalog-flags/{productId}")
    public ResponseEntity<SupplierResaleCatalogFlagDto> setFlag(
            @PathVariable String productId,
            @RequestParam(defaultValue = "false") boolean enabled,
            @RequestParam(required = false) String commercialNote,
            @RequestParam(required = false) java.math.BigDecimal wholesalePrice,
            @RequestParam(required = false) Integer minimumOrderQuantity,
            @AuthenticationPrincipal User actor) {
        return ResponseEntity.ok(resaleService.setResaleTerms(productId, enabled, commercialNote, wholesalePrice, minimumOrderQuantity, actor));
    }

    // --- Incoming requests ---

    @GetMapping("/requests")
    public ResponseEntity<Page<ResaleRequestResponseDto>> listRequests(
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String productId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @AuthenticationPrincipal User actor) {
        Pageable pageable = PageRequest.of(page, Math.min(size, 100));
        return ResponseEntity.ok(resaleService.listIncomingRequests(status, productId, actor, pageable));
    }

    @GetMapping("/requests/{requestId}")
    public ResponseEntity<ResaleRequestResponseDto> getRequest(
            @PathVariable UUID requestId,
            @AuthenticationPrincipal User actor) {
        return ResponseEntity.ok(resaleService.getRequest(requestId, actor));
    }

    @PostMapping("/requests/{requestId}/accept")
    public ResponseEntity<ResaleRequestResponseDto> acceptRequest(
            @PathVariable UUID requestId,
            @RequestBody(required = false) ReviewResaleRequestDto body,
            @AuthenticationPrincipal User actor) {
        String note = body == null ? null : body.getNote();
        return ResponseEntity.ok(resaleService.acceptRequest(requestId, note, body == null ? null : body.getInitialAllocationQuantity(), actor));
    }

    @PostMapping("/requests/{requestId}/approve")
    public ResponseEntity<ResaleRequestResponseDto> approveRequest(
            @PathVariable UUID requestId,
            @RequestBody(required = false) ReviewResaleRequestDto body,
            @AuthenticationPrincipal User actor) {
        String note = body == null ? null : body.getNote();
        return ResponseEntity.ok(resaleService.acceptRequest(requestId, note, body == null ? null : body.getInitialAllocationQuantity(), actor));
    }

    @PostMapping("/requests/{requestId}/reject")
    public ResponseEntity<ResaleRequestResponseDto> rejectRequest(
            @PathVariable UUID requestId,
            @RequestBody ReviewResaleRequestDto body,
            @AuthenticationPrincipal User actor) {
        String note = body == null ? null : body.getNote();
        return ResponseEntity.ok(resaleService.rejectRequest(requestId, note, actor));
    }

    // --- Seller Profile Inspection ---

    @GetMapping("/sellers/{sellerId}/profile")
    public ResponseEntity<SellerProfileDto> getSellerProfile(
            @PathVariable UUID sellerId,
            @AuthenticationPrincipal User actor) {
        return ResponseEntity.ok(resaleService.getSellerProfileForSupplier(sellerId, actor));
    }

    // --- Partnership authorizations ---

    @GetMapping("/authorizations")
    public ResponseEntity<Page<ResaleAuthorizationDto>> listAuthorizations(
            @RequestParam(defaultValue = "false") boolean activeOnly,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @AuthenticationPrincipal User actor) {
        return ResponseEntity.ok(resaleService.listSupplierAuthorizations(activeOnly, actor,
                PageRequest.of(page, Math.min(size, 100))));
    }

    @PostMapping("/authorizations/{authorizationId}/revoke")
    public ResponseEntity<ResaleAuthorizationDto> revokeAuthorization(
            @PathVariable UUID authorizationId,
            @RequestBody @Valid RevokeAuthorizationDto body,
            @AuthenticationPrincipal User actor) {
        return ResponseEntity.ok(resaleService.revokeAuthorization(authorizationId, body.getReason(), actor));
    }
}
