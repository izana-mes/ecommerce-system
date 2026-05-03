package com.example.shop.modules.staff.controller;

import com.example.shop.modules.staff.dto.StaffDashboardDto;
import com.example.shop.modules.staff.service.StaffDashboardService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/staff/dashboard")
@RequiredArgsConstructor
public class StaffDashboardController {

    private final StaffDashboardService staffDashboardService;

    /**
     * GET /api/v1/staff/dashboard
     * Returns KPIs: orders today, revenue today, active shippers,
     * late deliveries, near-late deliveries, pending/processing counts,
     * and 7-day revenue trend.
     */
    @GetMapping
    @PreAuthorize("hasAnyRole('ADMIN', 'STAFF', 'EMPLOYEE')")
    public ResponseEntity<StaffDashboardDto> getDashboard() {
        return ResponseEntity.ok(staffDashboardService.getDashboard());
    }
}
