package com.example.shop.modules.attendance.controller;

import com.example.shop.modules.attendance.service.AttendanceService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
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
            @RequestParam(value = "limit", required = false, defaultValue = "50") int limit
    ) {
        try {
            return ResponseEntity.ok(attendanceService.getAdminAttendanceSnapshot(
                    new AttendanceService.AdminAttendanceFilters(query, status, dateFrom, dateTo, limit)
            ));
        } catch (Exception error) {
            String message = error.getMessage() == null ? "Failed to fetch attendance dashboard." : error.getMessage();
            return ResponseEntity.badRequest().body(Map.of("error", message));
        }
    }
}
