package com.example.shop.modules.attendance.controller;

import com.example.shop.modules.attendance.service.AttendanceService;
import com.example.shop.modules.user.entity.User;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/api/attendance")
@RequiredArgsConstructor
public class AttendanceController {

    private final AttendanceService attendanceService;

    @GetMapping
    @PreAuthorize("hasAnyRole('ADMIN', 'STAFF', 'EMPLOYEE')")
    public ResponseEntity<?> getAttendance(@AuthenticationPrincipal User user) {
        try {
            return ResponseEntity.ok(attendanceService.getAttendanceSnapshot(user));
        } catch (Exception error) {
            String message = error.getMessage() == null ? "Failed to fetch attendance snapshot." : error.getMessage();
            return ResponseEntity.status(resolveStatus(message)).body(Map.of("error", message));
        }
    }

    @PostMapping
    @PreAuthorize("hasAnyRole('ADMIN', 'STAFF', 'EMPLOYEE')")
    public ResponseEntity<?> updateAttendance(
            @AuthenticationPrincipal User user,
            @RequestBody(required = false) Map<String, Object> body
    ) {
        try {
            String actionRaw = body == null ? null : String.valueOf(body.get("action"));
            String noteRaw = body == null || body.get("note") == null ? null : String.valueOf(body.get("note"));
            AttendanceService.AttendanceAction action = AttendanceService.AttendanceAction.fromWire(actionRaw);
            return ResponseEntity.ok(attendanceService.applyAttendanceAction(user, action, noteRaw));
        } catch (Exception error) {
            String message = error.getMessage() == null ? "Attendance action failed." : error.getMessage();
            return ResponseEntity.status(resolveStatus(message)).body(Map.of("error", message));
        }
    }

    @GetMapping("/reviews")
    @PreAuthorize("hasAnyRole('ADMIN', 'STAFF', 'EMPLOYEE')")
    public ResponseEntity<?> getCurrentEmployeeReviews(
            @AuthenticationPrincipal User user,
            @org.springframework.web.bind.annotation.RequestParam(value = "status", required = false) String status
    ) {
        try {
            return ResponseEntity.ok(attendanceService.getCurrentEmployeePerformanceReviews(user, status));
        } catch (Exception error) {
            String message = error.getMessage() == null ? "Failed to fetch performance reviews." : error.getMessage();
            return ResponseEntity.status(resolveStatus(message)).body(Map.of("error", message));
        }
    }

    @PatchMapping("/reviews/{reviewId}")
    @PreAuthorize("hasAnyRole('ADMIN', 'STAFF', 'EMPLOYEE')")
    public ResponseEntity<?> updateCurrentEmployeeReview(
            @AuthenticationPrincipal User user,
            @PathVariable("reviewId") String reviewId,
            @RequestBody(required = false) Map<String, Object> body
    ) {
        try {
            String status = body == null || body.get("status") == null ? null : String.valueOf(body.get("status"));
            return ResponseEntity.ok(attendanceService.updateCurrentEmployeePerformanceReviewStatus(user, reviewId, status));
        } catch (Exception error) {
            String message = error.getMessage() == null ? "Failed to update performance review." : error.getMessage();
            return ResponseEntity.status(resolveStatus(message)).body(Map.of("error", message));
        }
    }

    private HttpStatus resolveStatus(String message) {
        String normalized = message == null ? "" : message.toLowerCase();
        if (normalized.contains("forbidden")) {
            return HttpStatus.FORBIDDEN;
        }
        if (normalized.contains("missing authentication") || normalized.contains("unauthorized")) {
            return HttpStatus.UNAUTHORIZED;
        }
        if (normalized.contains("already") || normalized.contains("no active")) {
            return HttpStatus.CONFLICT;
        }
        if (normalized.contains("invalid action")) {
            return HttpStatus.BAD_REQUEST;
        }
        if (normalized.contains("not found")) {
            return HttpStatus.NOT_FOUND;
        }
        return HttpStatus.BAD_REQUEST;
    }
}
