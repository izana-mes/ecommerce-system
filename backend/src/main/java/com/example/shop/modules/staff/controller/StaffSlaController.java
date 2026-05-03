package com.example.shop.modules.staff.controller;

import com.example.shop.modules.staff.dto.SlaOrderDto;
import com.example.shop.modules.staff.service.SlaService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/staff/sla")
@RequiredArgsConstructor
public class StaffSlaController {

    private final SlaService slaService;

    /**
     * GET /api/v1/staff/sla/late
     * Returns all orders that are past their expected_delivery_at and not yet delivered.
     */
    @GetMapping("/late")
    @PreAuthorize("hasAnyRole('ADMIN', 'STAFF', 'EMPLOYEE')")
    public ResponseEntity<List<SlaOrderDto>> getLateOrders() {
        return ResponseEntity.ok(slaService.getLateOrders());
    }

    /**
     * GET /api/v1/staff/sla/near-late?thresholdMinutes=30
     * Returns orders whose delivery deadline falls within the next N minutes.
     */
    @GetMapping("/near-late")
    @PreAuthorize("hasAnyRole('ADMIN', 'STAFF', 'EMPLOYEE')")
    public ResponseEntity<List<SlaOrderDto>> getNearLateOrders(
            @RequestParam(defaultValue = "30") int thresholdMinutes
    ) {
        return ResponseEntity.ok(slaService.getNearLateOrders(thresholdMinutes));
    }
}
