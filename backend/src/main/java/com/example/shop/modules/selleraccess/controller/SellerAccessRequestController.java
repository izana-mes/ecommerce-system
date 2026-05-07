package com.example.shop.modules.selleraccess.controller;

import com.example.shop.modules.selleraccess.dto.SellerAccessRequestResponseDto;
import com.example.shop.modules.selleraccess.dto.request.CreateSellerAccessRequestDto;
import com.example.shop.modules.selleraccess.dto.request.ReviewSellerAccessRequestDto;
import com.example.shop.modules.selleraccess.service.SellerAccessRequestService;
import com.example.shop.modules.user.entity.User;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/seller-access")
@RequiredArgsConstructor
public class SellerAccessRequestController {

    private final SellerAccessRequestService sellerAccessRequestService;

    @PostMapping("/request")
    @PreAuthorize("isFullyAuthenticated()")
    public ResponseEntity<Map<String, Object>> createRequest(
            @Valid @RequestBody(required = false) CreateSellerAccessRequestDto request,
            @AuthenticationPrincipal User actor
    ) {
        SellerAccessRequestResponseDto created = sellerAccessRequestService.createRequest(request, actor);
        return ResponseEntity.accepted().body(Map.of(
                "message", "Seller access request submitted for admin review",
                "request", created
        ));
    }

    @GetMapping("/me")
    @PreAuthorize("isFullyAuthenticated()")
    public ResponseEntity<SellerAccessRequestResponseDto> getMyLatestRequest(@AuthenticationPrincipal User actor) {
        SellerAccessRequestResponseDto request = sellerAccessRequestService.getLatestForCurrentUser(actor);
        if (request == null) {
            return ResponseEntity.noContent().build();
        }
        return ResponseEntity.ok(request);
    }

    @GetMapping("/requests")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<List<SellerAccessRequestResponseDto>> listRequests(
            @RequestParam(value = "status", required = false) String status
    ) {
        return ResponseEntity.ok(sellerAccessRequestService.listRequests(status));
    }

    @PostMapping("/requests/{requestId}/approve")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<SellerAccessRequestResponseDto> approveRequest(
            @PathVariable("requestId") UUID requestId,
            @RequestBody(required = false) ReviewSellerAccessRequestDto request,
            @AuthenticationPrincipal User actor
    ) {
        return ResponseEntity.ok(
                sellerAccessRequestService.approve(requestId, actor, request == null ? null : request.getNote())
        );
    }

    @PostMapping("/requests/{requestId}/reject")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<SellerAccessRequestResponseDto> rejectRequest(
            @PathVariable("requestId") UUID requestId,
            @RequestBody(required = false) ReviewSellerAccessRequestDto request,
            @AuthenticationPrincipal User actor
    ) {
        return ResponseEntity.ok(
                sellerAccessRequestService.reject(requestId, actor, request == null ? null : request.getNote())
        );
    }
}

