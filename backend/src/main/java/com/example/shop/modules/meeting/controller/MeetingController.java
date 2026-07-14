package com.example.shop.modules.meeting.controller;

import com.example.shop.common.response.ApiResponse;
import com.example.shop.modules.meeting.service.MeetingService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/meetings")
@RequiredArgsConstructor
public class MeetingController {

    private final MeetingService meetingService;

    @GetMapping
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<List<Map<String, Object>>>> list(
            @RequestParam(required = false) String from,
            @RequestParam(required = false) String to,
            @RequestParam(defaultValue = "week") String view,
            @RequestParam(defaultValue = "false") boolean team,
            @AuthenticationPrincipal UserDetails principal) {
        return ResponseEntity.ok(ApiResponse.success(meetingService.listMeetings(
                principal.getUsername(), instantOrNull(from), instantOrNull(to), view, team)));
    }

    @PostMapping
    @PreAuthorize("hasAnyRole('ADMIN','STAFF','EMPLOYEE','SHIPPER','SUPPLIER')")
    public ResponseEntity<ApiResponse<Map<String, Object>>> create(
            @RequestBody Map<String, Object> body,
            @AuthenticationPrincipal UserDetails principal) {
        return ResponseEntity.ok(ApiResponse.success(meetingService.createMeeting(body, principal.getUsername())));
    }

    @GetMapping("/{id}")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<Map<String, Object>>> get(
            @PathVariable UUID id,
            @AuthenticationPrincipal UserDetails principal) {
        return ResponseEntity.ok(ApiResponse.success(meetingService.getMeeting(id, principal.getUsername())));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN','STAFF','EMPLOYEE','SHIPPER','SUPPLIER')")
    public ResponseEntity<ApiResponse<Map<String, Object>>> update(
            @PathVariable UUID id,
            @RequestBody Map<String, Object> body,
            @AuthenticationPrincipal UserDetails principal) {
        return ResponseEntity.ok(ApiResponse.success(meetingService.updateMeeting(id, body, principal.getUsername())));
    }

    @PatchMapping("/{id}/reschedule")
    @PreAuthorize("hasAnyRole('ADMIN','STAFF','EMPLOYEE','SHIPPER','SUPPLIER')")
    public ResponseEntity<ApiResponse<Map<String, Object>>> reschedule(
            @PathVariable UUID id,
            @RequestBody Map<String, Object> body,
            @AuthenticationPrincipal UserDetails principal) {
        return ResponseEntity.ok(ApiResponse.success(meetingService.reschedule(id, body, principal.getUsername())));
    }

    @PatchMapping("/{id}/cancel")
    @PreAuthorize("hasAnyRole('ADMIN','STAFF','EMPLOYEE','SHIPPER','SUPPLIER')")
    public ResponseEntity<ApiResponse<Map<String, Object>>> cancel(
            @PathVariable UUID id,
            @AuthenticationPrincipal UserDetails principal) {
        return ResponseEntity.ok(ApiResponse.success(meetingService.cancel(id, principal.getUsername())));
    }

    @PatchMapping("/{id}/attendance")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<Map<String, Object>>> attendance(
            @PathVariable UUID id,
            @RequestBody Map<String, Object> body,
            @AuthenticationPrincipal UserDetails principal) {
        return ResponseEntity.ok(ApiResponse.success(meetingService.updateAttendance(id, body, principal.getUsername())));
    }

    @GetMapping("/availability")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<Map<String, Object>>> availability(
            @RequestParam String participants,
            @RequestParam String startAt,
            @RequestParam String endAt) {
        List<String> emails = Arrays.stream(participants.split(","))
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .toList();
        return ResponseEntity.ok(ApiResponse.success(meetingService.availability(
                emails, Instant.parse(startAt), Instant.parse(endAt))));
    }

    @GetMapping("/analytics")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<Map<String, Object>>> analytics(
            @RequestParam(required = false) String from,
            @RequestParam(required = false) String to,
            @AuthenticationPrincipal UserDetails principal) {
        return ResponseEntity.ok(ApiResponse.success(meetingService.analytics(
                principal.getUsername(), instantOrNull(from), instantOrNull(to))));
    }

    @GetMapping("/{id}/messages")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<List<Map<String, Object>>>> messages(
            @PathVariable UUID id,
            @AuthenticationPrincipal UserDetails principal) {
        return ResponseEntity.ok(ApiResponse.success(meetingService.messages(id, principal.getUsername())));
    }

    @PostMapping("/{id}/messages")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<Map<String, Object>>> postMessage(
            @PathVariable UUID id,
            @RequestBody Map<String, Object> body,
            @AuthenticationPrincipal UserDetails principal) {
        return ResponseEntity.ok(ApiResponse.success(meetingService.postMessage(id, body, principal.getUsername())));
    }

    @GetMapping("/{id}/comments")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<List<Map<String, Object>>>> comments(
            @PathVariable UUID id,
            @AuthenticationPrincipal UserDetails principal) {
        return ResponseEntity.ok(ApiResponse.success(meetingService.comments(id, principal.getUsername())));
    }

    @PostMapping("/{id}/comments")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<Map<String, Object>>> postComment(
            @PathVariable UUID id,
            @RequestBody Map<String, Object> body,
            @AuthenticationPrincipal UserDetails principal) {
        return ResponseEntity.ok(ApiResponse.success(meetingService.postComment(id, body, principal.getUsername())));
    }

    @PostMapping("/{id}/action-items")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<Map<String, Object>>> createActionItem(
            @PathVariable UUID id,
            @RequestBody Map<String, Object> body,
            @AuthenticationPrincipal UserDetails principal) {
        return ResponseEntity.ok(ApiResponse.success(meetingService.createActionItem(id, body, principal.getUsername())));
    }

    @PatchMapping("/{id}/action-items/{itemId}")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<Map<String, Object>>> updateActionItem(
            @PathVariable UUID id,
            @PathVariable UUID itemId,
            @RequestBody Map<String, Object> body,
            @AuthenticationPrincipal UserDetails principal) {
        return ResponseEntity.ok(ApiResponse.success(meetingService.updateActionItem(id, itemId, body, principal.getUsername())));
    }

    private Instant instantOrNull(String value) {
        return value == null || value.isBlank() ? null : Instant.parse(value);
    }
}
