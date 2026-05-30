package com.example.shop.modules.workspace.controller;

import com.example.shop.common.response.ApiResponse;
import com.example.shop.modules.workspace.service.WorkspaceService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/workspace")
@RequiredArgsConstructor
public class WorkspaceController {

    private final WorkspaceService workspaceService;

    @PostMapping("/tasks")
    @PreAuthorize("hasAnyRole('ADMIN','EMPLOYEE','SUPPLIER')")
    public ResponseEntity<ApiResponse<Map<String, Object>>> createTask(
            @RequestBody Map<String, Object> body,
            @AuthenticationPrincipal UserDetails principal) {
        return ResponseEntity.ok(ApiResponse.success(workspaceService.createTask(body, principal.getUsername())));
    }

    @GetMapping("/tasks")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<List<Map<String, Object>>>> listTasks(
            @RequestParam(required = false) String assignedTo,
            @RequestParam(required = false) String status,
            @RequestParam(defaultValue = "20") int limit,
            @AuthenticationPrincipal UserDetails principal) {
        String effectiveAssignedTo = assignedTo;
        if (effectiveAssignedTo == null || effectiveAssignedTo.isBlank()) {
            effectiveAssignedTo = principal.getUsername();
        }
        return ResponseEntity.ok(ApiResponse.success(workspaceService.listTasks(effectiveAssignedTo, status, limit)));
    }

    @PatchMapping("/tasks/{id}/status")
    @PreAuthorize("hasAnyRole('ADMIN','EMPLOYEE','SUPPLIER')")
    public ResponseEntity<ApiResponse<Map<String, Object>>> updateStatus(
            @PathVariable Long id,
            @RequestBody Map<String, Object> body,
            @AuthenticationPrincipal UserDetails principal) {
        String status = body.get("status") == null ? "" : body.get("status").toString();
        String notes = body.get("notes") == null ? null : body.get("notes").toString();
        return ResponseEntity.ok(ApiResponse.success(workspaceService.updateTaskStatus(id, status, principal.getUsername(), notes)));
    }

    @PatchMapping("/tasks/{id}/assign")
    @PreAuthorize("hasAnyRole('ADMIN','EMPLOYEE')")
    public ResponseEntity<ApiResponse<Map<String, Object>>> assignTask(
            @PathVariable Long id,
            @RequestBody Map<String, Object> body,
            @AuthenticationPrincipal UserDetails principal) {
        String assignee = body.get("assigned_to") == null ? "" : body.get("assigned_to").toString();
        return ResponseEntity.ok(ApiResponse.success(workspaceService.assignTask(id, assignee, principal.getUsername())));
    }

    @PatchMapping("/tasks/{id}/escalate")
    @PreAuthorize("hasAnyRole('ADMIN','EMPLOYEE')")
    public ResponseEntity<ApiResponse<Map<String, Object>>> escalateTask(
            @PathVariable Long id,
            @RequestBody(required = false) Map<String, Object> body,
            @AuthenticationPrincipal UserDetails principal) {
        String reason = body == null || body.get("reason") == null ? null : body.get("reason").toString();
        return ResponseEntity.ok(ApiResponse.success(workspaceService.escalateTask(id, principal.getUsername(), reason)));
    }

    @GetMapping("/notifications")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<List<Map<String, Object>>>> myNotifications(
            @RequestParam(defaultValue = "false") boolean unreadOnly,
            @RequestParam(defaultValue = "20") int limit,
            @AuthenticationPrincipal UserDetails principal) {
        return ResponseEntity.ok(ApiResponse.success(workspaceService.listNotifications(principal.getUsername(), unreadOnly, limit)));
    }

    @PatchMapping("/notifications/{id}/read")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<String>> markRead(
            @PathVariable Long id,
            @AuthenticationPrincipal UserDetails principal) {
        workspaceService.markNotificationRead(id, principal.getUsername());
        return ResponseEntity.ok(ApiResponse.success("Notification marked as read"));
    }

    @GetMapping("/audit-events")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<List<Map<String, Object>>>> latestAudit(
            @RequestParam(defaultValue = "50") int limit) {
        return ResponseEntity.ok(ApiResponse.success(workspaceService.listAuditEvents(limit)));
    }

    @GetMapping("/reports/export")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<byte[]> export(
            @RequestParam(defaultValue = "workflow") String type,
            @AuthenticationPrincipal UserDetails principal) {
        return workspaceService.exportReport(type, principal.getUsername());
    }
}
