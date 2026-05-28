package com.example.shop.modules.shift.controller;

import com.example.shop.modules.shift.dto.ShiftDtos.*;
import com.example.shop.modules.shift.entity.ShiftStatus;
import com.example.shop.modules.shift.service.ShiftImportService;
import com.example.shop.modules.shift.service.ShiftService;
import com.example.shop.modules.user.entity.User;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.time.LocalDate;
import java.util.UUID;

@RestController
@RequiredArgsConstructor
public class ShiftController {
    private final ShiftService shiftService;
    private final ShiftImportService shiftImportService;

    @GetMapping("/api/admin/shifts")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ScheduleResponse> adminSchedule(
            @RequestParam(required = false) UUID assigneeId,
            @RequestParam(required = false) ShiftStatus status,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestParam(required = false) String timezone
    ) {
        return ResponseEntity.ok(shiftService.search(assigneeId, status, from, to, timezone));
    }

    @PostMapping("/api/admin/shifts")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ShiftResponse> create(@AuthenticationPrincipal User user, @Valid @RequestBody ShiftRequest request) {
        return ResponseEntity.ok(shiftService.create(user, request));
    }

    @PutMapping("/api/admin/shifts/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ShiftResponse> update(@PathVariable UUID id, @AuthenticationPrincipal User user,
                                                @Valid @RequestBody ShiftRequest request) {
        return ResponseEntity.ok(shiftService.update(id, user, request));
    }

    @DeleteMapping("/api/admin/shifts/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Void> delete(@PathVariable UUID id, @AuthenticationPrincipal User user) {
        shiftService.delete(id, user);
        return ResponseEntity.noContent().build();
    }

    @PostMapping(value = "/api/admin/shifts/import/preview", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ImportPreviewResponse> preview(@RequestPart("file") MultipartFile file,
                                                         @RequestParam(required = false) String timezone) {
        return ResponseEntity.ok(shiftImportService.preview(file, timezone));
    }

    @PostMapping(value = "/api/admin/shifts/import", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ImportExecuteResponse> execute(@AuthenticationPrincipal User user,
                                                         @RequestPart("file") MultipartFile file,
                                                         @RequestParam(required = false) String timezone) {
        return ResponseEntity.ok(shiftImportService.execute(file, timezone, user));
    }

    @GetMapping("/api/shifts/me")
    @PreAuthorize("hasAnyRole('EMPLOYEE', 'SHIPPER', 'ADMIN')")
    public ResponseEntity<ScheduleResponse> mySchedule(
            @AuthenticationPrincipal User user,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestParam(required = false) String timezone
    ) {
        return ResponseEntity.ok(shiftService.mySchedule(user, from, to, timezone));
    }

    @PatchMapping("/api/shifts/{id}/status")
    @PreAuthorize("hasAnyRole('EMPLOYEE', 'SHIPPER', 'ADMIN')")
    public ResponseEntity<ShiftResponse> updateStatus(@PathVariable UUID id, @AuthenticationPrincipal User user,
                                                      @Valid @RequestBody StatusRequest request) {
        return ResponseEntity.ok(shiftService.updateStatus(id, user, request.status()));
    }

    @PostMapping("/api/shifts/{id}/swap-requests")
    @PreAuthorize("hasAnyRole('EMPLOYEE', 'SHIPPER')")
    public ResponseEntity<UserRequestResponse> requestSwap(@PathVariable UUID id, @AuthenticationPrincipal User user,
                                                           @RequestBody SwapRequest request) {
        return ResponseEntity.ok(shiftService.requestSwap(id, user, request));
    }

    @PostMapping("/api/shifts/leave-requests")
    @PreAuthorize("hasAnyRole('EMPLOYEE', 'SHIPPER')")
    public ResponseEntity<UserRequestResponse> requestLeave(@AuthenticationPrincipal User user,
                                                            @Valid @RequestBody LeaveRequest request) {
        return ResponseEntity.ok(shiftService.requestLeave(user, request));
    }
}
