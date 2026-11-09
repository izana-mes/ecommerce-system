package com.example.shop.modules.admin.controller;

import com.example.shop.common.response.ApiResponse;
import com.example.shop.modules.productapproval.dto.ProductChangeRequestResponseDto;
import com.example.shop.modules.productapproval.dto.request.ReviewProductChangeRequestDto;
import com.example.shop.modules.productapproval.service.ProductChangeRequestService;
import com.example.shop.modules.user.entity.User;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

/**
 * Admin-only product moderation panel.
 *
 * <p>All decisions (approve / reject / request-changes) are recorded with the
 * acting admin's identity and timestamp via {@link ProductChangeRequestService}.
 *
 * <p>Endpoints:
 * <ul>
 *   <li>GET  /api/v1/admin/product-submissions                – list all submissions (filterable by status)</li>
 *   <li>POST /api/v1/admin/product-submissions/{id}/approve    – approve a pending submission</li>
 *   <li>POST /api/v1/admin/product-submissions/{id}/reject     – reject a pending submission</li>
 *   <li>POST /api/v1/admin/product-submissions/{id}/request-changes – return for corrections</li>
 * </ul>
 */
@RestController
@RequestMapping("/api/v1/admin/product-submissions")
@RequiredArgsConstructor
public class AdminProductModerationController {

    private final ProductChangeRequestService productChangeRequestService;

    /**
     * List all product change submissions.
     * Optional {@code ?status=PENDING|APPROVED|REJECTED|CHANGES_REQUESTED} filter.
     */
    @GetMapping
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<List<ProductChangeRequestResponseDto>>> listSubmissions(
            @RequestParam(value = "status", required = false) String status
    ) {
        return ResponseEntity.ok(ApiResponse.success(productChangeRequestService.listRequests(status)));
    }

    /**
     * Approve a pending product submission.
     * This actually applies the change (creates/updates/deletes the product).
     */
    @PostMapping("/{submissionId}/approve")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<ProductChangeRequestResponseDto>> approve(
            @PathVariable UUID submissionId,
            @RequestBody(required = false) ReviewProductChangeRequestDto body,
            @AuthenticationPrincipal User admin
    ) {
        String note = body == null ? null : body.getNote();
        return ResponseEntity.ok(ApiResponse.success(
                productChangeRequestService.approve(submissionId, admin, note)));
    }

    /**
     * Reject a pending product submission.
     * The rejection reason is preserved in reviewer_note.
     */
    @PostMapping("/{submissionId}/reject")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<ProductChangeRequestResponseDto>> reject(
            @PathVariable UUID submissionId,
            @RequestBody(required = false) ReviewProductChangeRequestDto body,
            @AuthenticationPrincipal User admin
    ) {
        String note = body == null ? null : body.getNote();
        return ResponseEntity.ok(ApiResponse.success(
                productChangeRequestService.reject(submissionId, admin, note)));
    }

    /**
     * Request corrections on a pending submission.
     * A reviewer note explaining what needs to change is mandatory.
     * The submitter can then resubmit via POST /api/products/change-requests/{id}/resubmit.
     */
    @PostMapping("/{submissionId}/request-changes")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<ProductChangeRequestResponseDto>> requestChanges(
            @PathVariable UUID submissionId,
            @RequestBody ReviewProductChangeRequestDto body,
            @AuthenticationPrincipal User admin
    ) {
        String note = body == null ? null : body.getNote();
        return ResponseEntity.ok(ApiResponse.success(
                productChangeRequestService.requestChanges(submissionId, admin, note)));
    }
}
