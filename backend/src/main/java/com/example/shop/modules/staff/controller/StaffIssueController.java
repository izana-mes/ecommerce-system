package com.example.shop.modules.staff.controller;

import com.example.shop.modules.staff.dto.IssueDto;
import com.example.shop.modules.staff.dto.RespondIssueRequest;
import com.example.shop.modules.staff.service.IssueService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/staff/issues")
@RequiredArgsConstructor
public class StaffIssueController {

    private final IssueService issueService;

    /**
     * GET /api/v1/staff/issues?status=OPEN
     * List all shipper issues and help requests (optionally filter by status).
     */
    @GetMapping
    @PreAuthorize("hasAnyRole('ADMIN', 'STAFF', 'EMPLOYEE')")
    public ResponseEntity<List<IssueDto>> listIssues(
            @RequestParam(required = false) String status
    ) {
        return ResponseEntity.ok(issueService.listIssues(status));
    }

    /**
     * POST /api/v1/staff/issues/logs/{id}/respond
     * Respond to a shipper_issue_log entry (optionally mark as resolved).
     */
    @PostMapping("/logs/{id}/respond")
    @PreAuthorize("hasAnyRole('ADMIN', 'STAFF', 'EMPLOYEE')")
    public ResponseEntity<IssueDto> respondToIssueLog(
            @PathVariable Long id,
            @RequestBody RespondIssueRequest request,
            Authentication authentication
    ) {
        return ResponseEntity.ok(issueService.respondToIssueLog(id, request, authentication.getName()));
    }

    /**
     * POST /api/v1/staff/issues/help/{id}/respond
     * Respond to a shipper_help_request entry (optionally mark as resolved).
     */
    @PostMapping("/help/{id}/respond")
    @PreAuthorize("hasAnyRole('ADMIN', 'STAFF', 'EMPLOYEE')")
    public ResponseEntity<IssueDto> respondToHelpRequest(
            @PathVariable Long id,
            @RequestBody RespondIssueRequest request,
            Authentication authentication
    ) {
        return ResponseEntity.ok(issueService.respondToHelpRequest(id, request, authentication.getName()));
    }
}
