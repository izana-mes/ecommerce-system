package com.example.shop.modules.attendance.controller;

import com.example.shop.modules.attendance.service.AttendanceService;
import com.example.shop.modules.user.entity.User;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
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
        return HttpStatus.BAD_REQUEST;
    }
}
