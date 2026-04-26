package com.example.shop.modules.attendance.controller;

import com.example.shop.modules.attendance.service.AttendanceService;
import com.example.shop.modules.user.entity.User;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/api/admin/attendance")
@RequiredArgsConstructor
public class AdminAttendanceController {

    private final AttendanceService attendanceService;

    @GetMapping
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<?> getAttendance(
            @RequestParam(value = "query", required = false) String query,
            @RequestParam(value = "status", required = false, defaultValue = "all") String status,
            @RequestParam(value = "dateFrom", required = false) String dateFrom,
            @RequestParam(value = "dateTo", required = false) String dateTo,
            @RequestParam(value = "reviewStatus", required = false, defaultValue = "all") String reviewStatus,
            @RequestParam(value = "limit", required = false, defaultValue = "50") int limit
    ) {
        try {
            return ResponseEntity.ok(attendanceService.getAdminAttendanceSnapshot(
                    new AttendanceService.AdminAttendanceFilters(query, status, dateFrom, dateTo, reviewStatus, limit)
            ));
        } catch (Exception error) {
            String message = error.getMessage() == null ? "Failed to fetch attendance dashboard." : error.getMessage();
            return ResponseEntity.badRequest().body(Map.of("error", message));
        }
    }

    @PostMapping("/reviews")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<?> createPerformanceReview(
            @AuthenticationPrincipal User user,
            @RequestBody(required = false) Map<String, Object> body
    ) {
        try {
            AttendanceService.AdminPerformanceReviewRequest request = new AttendanceService.AdminPerformanceReviewRequest(
                    readString(body, "employeeUserId"),
                    readString(body, "employeeEmail"),
                    readString(body, "employeeName"),
                    readString(body, "reviewType"),
                    readString(body, "category"),
                    readString(body, "title"),
                    readString(body, "summary"),
                    readString(body, "relatedShiftId"),
                    readBoolean(body, "sendEmail")
            );
            return ResponseEntity.ok(attendanceService.createAdminPerformanceReview(user, request));
        } catch (Exception error) {
            String message = error.getMessage() == null ? "Failed to create performance review." : error.getMessage();
            return ResponseEntity.badRequest().body(Map.of("error", message));
        }
    }

    @PatchMapping("/reviews/{reviewId}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<?> updatePerformanceReview(
            @AuthenticationPrincipal User user,
            @org.springframework.web.bind.annotation.PathVariable("reviewId") String reviewId,
            @RequestBody(required = false) Map<String, Object> body
    ) {
        try {
            AttendanceService.AdminPerformanceReviewUpdateRequest request =
                    new AttendanceService.AdminPerformanceReviewUpdateRequest(
                            readString(body, "status"),
                            readString(body, "title"),
                            readString(body, "summary"),
                            readBoolean(body, "resendEmail")
                    );
            return ResponseEntity.ok(attendanceService.updateAdminPerformanceReview(user, reviewId, request));
        } catch (Exception error) {
            String message = error.getMessage() == null ? "Failed to update performance review." : error.getMessage();
            return ResponseEntity.badRequest().body(Map.of("error", message));
        }
    }

    private String readString(Map<String, Object> body, String key) {
        return body == null || body.get(key) == null ? null : String.valueOf(body.get(key));
    }

    private boolean readBoolean(Map<String, Object> body, String key) {
        if (body == null || body.get(key) == null) {
            return false;
        }
        Object value = body.get(key);
        if (value instanceof Boolean bool) {
            return bool;
        }
        return Boolean.parseBoolean(String.valueOf(value));
    }
}
