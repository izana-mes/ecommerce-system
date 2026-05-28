package com.example.shop.modules.shift.dto;

import com.example.shop.modules.shift.entity.RequestStatus;
import com.example.shop.modules.shift.entity.ShiftRole;
import com.example.shop.modules.shift.entity.ShiftStatus;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

public final class ShiftDtos {
    private ShiftDtos() {
    }

    public record ShiftRequest(
            @NotBlank String assigneeCode,
            @NotNull ShiftRole role,
            @NotNull LocalDate shiftDate,
            @NotBlank String startTime,
            @NotBlank String endTime,
            String timezone,
            @NotBlank String location,
            String note,
            ShiftStatus status
    ) {}

    public record ShiftResponse(
            UUID id,
            String assigneeCode,
            UUID assigneeUserId,
            String assigneeName,
            String assigneeEmail,
            ShiftRole role,
            LocalDate shiftDate,
            Instant startAt,
            Instant endAt,
            String timezone,
            String location,
            String note,
            ShiftStatus status,
            double durationHours,
            List<String> warnings
    ) {}

    public record ScheduleResponse(
            String timezone,
            Instant from,
            Instant to,
            double totalHours,
            List<String> warnings,
            List<ShiftResponse> shifts
    ) {}

    public record StatusRequest(@NotNull ShiftStatus status) {}

    public record SwapRequest(UUID targetUserId, String reason) {}

    public record LeaveRequest(@NotNull LocalDate startDate, @NotNull LocalDate endDate, String reason) {}

    public record UserRequestResponse(UUID id, UUID shiftId, RequestStatus status, String reason, Instant createdAt) {}

    public record ImportRow(
            int rowNumber,
            String employeeCode,
            String role,
            String shiftDate,
            String startTime,
            String endTime,
            String location,
            String note,
            List<String> errors,
            List<String> warnings
    ) {
        public boolean valid() {
            return errors == null || errors.isEmpty();
        }
    }

    public record ImportPreviewResponse(
            String fileName,
            int totalRows,
            int validRows,
            int invalidRows,
            List<ImportRow> rows
    ) {}

    public record ImportExecuteResponse(UUID batchId, int importedRows, int invalidRows, String status) {}
}
