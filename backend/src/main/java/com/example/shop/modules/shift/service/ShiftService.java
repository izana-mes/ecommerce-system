package com.example.shop.modules.shift.service;

import com.example.shop.common.exception.BusinessException;
import com.example.shop.modules.shift.dto.ShiftDtos.*;
import com.example.shop.modules.shift.entity.*;
import com.example.shop.modules.shift.repository.*;
import com.example.shop.modules.user.entity.User;
import com.example.shop.modules.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.time.*;
import java.util.*;

@Service
@RequiredArgsConstructor
public class ShiftService {
    private static final double WEEKLY_OVERTIME_LIMIT_HOURS = 48.0;
    private static final int MIN_STAFF_PER_DAY = 1;

    private final ShiftRepository shiftRepository;
    private final ShiftImportBatchRepository importBatchRepository;
    private final ShiftSwapRequestRepository swapRequestRepository;
    private final ShiftLeaveRequestRepository leaveRequestRepository;
    private final UserRepository userRepository;
    private final JdbcTemplate jdbcTemplate;

    @Value("${application.shift.timezone:Asia/Ho_Chi_Minh}")
    private String defaultTimezone;

    @Transactional(readOnly = true)
    public ScheduleResponse search(UUID assigneeId, ShiftStatus status, LocalDate fromDate, LocalDate toDate, String timezone) {
        ZoneId zone = zone(timezone);
        LocalDate safeFrom = fromDate == null ? LocalDate.now(zone) : fromDate;
        LocalDate safeTo = toDate == null ? safeFrom.plusDays(1) : toDate.plusDays(1);
        Instant from = safeFrom.atStartOfDay(zone).toInstant();
        Instant to = safeTo.atStartOfDay(zone).toInstant();
        List<Shift> shifts = shiftRepository.search(assigneeId, status, from, to);
        List<String> warnings = scheduleWarnings(shifts, safeFrom, safeTo.minusDays(1));
        double totalHours = shifts.stream().mapToDouble(this::durationHours).sum();
        return new ScheduleResponse(zone.getId(), from, to, round(totalHours), warnings, shifts.stream().map(this::toResponse).toList());
    }

    @Transactional
    public ShiftResponse create(User actor, ShiftRequest request) {
        Shift shift = buildShift(request, actor, ShiftSource.MANUAL, null);
        validateNoConflict(shift, null);
        Shift saved = shiftRepository.save(shift);
        audit("SHIFT_CREATED", saved.getId().toString(), actor, Map.of("assigneeCode", saved.getAssigneeCode()));
        return toResponse(saved);
    }

    @Transactional
    public ShiftResponse update(UUID id, User actor, ShiftRequest request) {
        Shift existing = shiftRepository.findById(id).orElseThrow(() -> new BusinessException("Shift not found."));
        Shift replacement = buildShift(request, actor, existing.getSource(), existing.getImportBatchId());
        existing.setAssignee(replacement.getAssignee());
        existing.setAssigneeCode(replacement.getAssigneeCode());
        existing.setAssigneeRole(replacement.getAssigneeRole());
        existing.setShiftDate(replacement.getShiftDate());
        existing.setStartAt(replacement.getStartAt());
        existing.setEndAt(replacement.getEndAt());
        existing.setTimezone(replacement.getTimezone());
        existing.setLocation(replacement.getLocation());
        existing.setNote(replacement.getNote());
        existing.setStatus(request.status() == null ? existing.getStatus() : request.status());
        existing.setUpdatedBy(actor);
        validateNoConflict(existing, id);
        Shift saved = shiftRepository.save(existing);
        audit("SHIFT_UPDATED", id.toString(), actor, Map.of("status", saved.getStatus().name()));
        return toResponse(saved);
    }

    @Transactional
    public void delete(UUID id, User actor) {
        Shift shift = shiftRepository.findById(id).orElseThrow(() -> new BusinessException("Shift not found."));
        shiftRepository.delete(shift);
        audit("SHIFT_DELETED", id.toString(), actor, Map.of("assigneeCode", shift.getAssigneeCode()));
    }

    @Transactional
    public ShiftResponse updateStatus(UUID id, User actor, ShiftStatus status) {
        Shift shift = shiftRepository.findById(id).orElseThrow(() -> new BusinessException("Shift not found."));
        if (!isAdmin(actor) && !shift.getAssignee().getId().equals(actor.getId())) {
            throw new BusinessException("You can only update your own shift.");
        }
        shift.setStatus(status);
        shift.setUpdatedBy(actor);
        Shift saved = shiftRepository.save(shift);
        audit("SHIFT_STATUS_UPDATED", id.toString(), actor, Map.of("status", status.name()));
        return toResponse(saved);
    }

    @Transactional(readOnly = true)
    public ScheduleResponse mySchedule(User user, LocalDate from, LocalDate to, String timezone) {
        return search(user.getId(), null, from, to, timezone);
    }

    @Transactional
    public UserRequestResponse requestSwap(UUID shiftId, User actor, SwapRequest request) {
        Shift shift = shiftRepository.findById(shiftId).orElseThrow(() -> new BusinessException("Shift not found."));
        if (!shift.getAssignee().getId().equals(actor.getId())) {
            throw new BusinessException("You can only swap your own shift.");
        }
        User target = request.targetUserId() == null ? null : userRepository.findById(request.targetUserId())
                .orElseThrow(() -> new BusinessException("Target user not found."));
        ShiftSwapRequest saved = swapRequestRepository.save(ShiftSwapRequest.builder()
                .shift(shift)
                .requester(actor)
                .targetUser(target)
                .reason(request.reason())
                .build());
        audit("SHIFT_SWAP_REQUESTED", shiftId.toString(), actor, Map.of("requestId", saved.getId().toString()));
        return new UserRequestResponse(saved.getId(), shiftId, saved.getStatus(), saved.getReason(), saved.getCreatedAt());
    }

    @Transactional
    public UserRequestResponse requestLeave(User actor, LeaveRequest request) {
        if (request.endDate().isBefore(request.startDate())) {
            throw new BusinessException("Leave end date must be on or after start date.");
        }
        ShiftLeaveRequest saved = leaveRequestRepository.save(ShiftLeaveRequest.builder()
                .requester(actor)
                .startDate(request.startDate())
                .endDate(request.endDate())
                .reason(request.reason())
                .build());
        audit("SHIFT_LEAVE_REQUESTED", saved.getId().toString(), actor, Map.of("startDate", request.startDate().toString()));
        return new UserRequestResponse(saved.getId(), null, saved.getStatus(), saved.getReason(), saved.getCreatedAt());
    }

    public ShiftResponse toResponse(Shift shift) {
        User user = shift.getAssignee();
        String name = String.join(" ", Optional.ofNullable(user.getFirstName()).orElse(""),
                Optional.ofNullable(user.getLastName()).orElse("")).trim();
        List<String> warnings = new ArrayList<>();
        if (!shiftRepository.findOverlaps(user.getId(), shift.getStartAt(), shift.getEndAt(), shift.getId()).isEmpty()) {
            warnings.add("Overlapping shift for assignee");
        }
        return new ShiftResponse(shift.getId(), shift.getAssigneeCode(), user.getId(),
                name.isBlank() ? user.getEmail() : name, user.getEmail(), shift.getAssigneeRole(), shift.getShiftDate(),
                shift.getStartAt(), shift.getEndAt(), shift.getTimezone(), shift.getLocation(), shift.getNote(),
                shift.getStatus(), round(durationHours(shift)), warnings);
    }

    Shift buildShift(ShiftRequest request, User actor, ShiftSource source, UUID importBatchId) {
        ZoneId zone = zone(request.timezone());
        LocalTime start = parseTime(request.startTime(), "start_time");
        LocalTime end = parseTime(request.endTime(), "end_time");
        LocalDate endDate = end.isAfter(start) ? request.shiftDate() : request.shiftDate().plusDays(1);
        User assignee = resolveAssignee(request.assigneeCode(), request.role());
        return Shift.builder()
                .assignee(assignee)
                .assigneeCode(request.assigneeCode().trim())
                .assigneeRole(request.role())
                .shiftDate(request.shiftDate())
                .startAt(ZonedDateTime.of(request.shiftDate(), start, zone).toInstant())
                .endAt(ZonedDateTime.of(endDate, end, zone).toInstant())
                .timezone(zone.getId())
                .location(request.location().trim())
                .note(request.note())
                .status(request.status() == null ? ShiftStatus.PENDING : request.status())
                .source(source)
                .importBatchId(importBatchId)
                .createdBy(actor)
                .updatedBy(actor)
                .build();
    }

    void validateNoConflict(Shift shift, UUID excludeId) {
        if (!shiftRepository.findOverlaps(shift.getAssignee().getId(), shift.getStartAt(), shift.getEndAt(), excludeId).isEmpty()) {
            throw new BusinessException("Shift overlaps an existing shift for this assignee.");
        }
        ZoneId zone = zone(shift.getTimezone());
        LocalDate weekStart = shift.getShiftDate().minusDays(shift.getShiftDate().getDayOfWeek().getValue() - 1L);
        Instant from = weekStart.atStartOfDay(zone).toInstant();
        Instant to = weekStart.plusDays(7).atStartOfDay(zone).toInstant();
        double weekHours = shiftRepository.search(shift.getAssignee().getId(), null, from, to).stream()
                .filter(existing -> excludeId == null || !existing.getId().equals(excludeId))
                .mapToDouble(this::durationHours)
                .sum() + durationHours(shift);
        if (weekHours > WEEKLY_OVERTIME_LIMIT_HOURS) {
            throw new BusinessException("Weekly overtime limit exceeded for this assignee.");
        }
    }

    User resolveAssignee(String code, ShiftRole role) {
        if (!StringUtils.hasText(code)) {
            throw new BusinessException("employee_code is required.");
        }
        User user = userRepository.findByUsernameIgnoreCase(code.trim())
                .or(() -> userRepository.findByEmailIgnoreCase(code.trim()))
                .orElseThrow(() -> new BusinessException("No employee/shipper found for code: " + code));
        String expectedRole = role == ShiftRole.SHIPPER ? "ROLE_SHIPPER" : "ROLE_EMPLOYEE";
        boolean hasRole = user.getRoles() != null && user.getRoles().stream().anyMatch(r -> expectedRole.equals(r.getName()));
        if (!hasRole) {
            throw new BusinessException("User " + code + " does not have " + expectedRole + ".");
        }
        return user;
    }

    private List<String> scheduleWarnings(List<Shift> shifts, LocalDate from, LocalDate to) {
        List<String> warnings = new ArrayList<>();
        Map<LocalDate, Long> staffingByDay = new HashMap<>();
        for (Shift shift : shifts) {
            staffingByDay.merge(shift.getShiftDate(), 1L, Long::sum);
        }
        // Only check for gaps when the schedule has at least some coverage.
        // An entirely empty schedule produces no staffing warnings to avoid
        // false positives when no shifts have been created yet.
        if (staffingByDay.isEmpty()) {
            return warnings;
        }
        LocalDate cursor = from;
        while (!cursor.isAfter(to)) {
            if (staffingByDay.getOrDefault(cursor, 0L) < MIN_STAFF_PER_DAY) {
                warnings.add("Insufficient staffing on " + cursor);
            }
            cursor = cursor.plusDays(1);
        }
        return warnings;
    }

    private ZoneId zone(String timezone) {
        return ZoneId.of(StringUtils.hasText(timezone) ? timezone.trim() : defaultTimezone);
    }

    private LocalTime parseTime(String value, String field) {
        try {
            return LocalTime.parse(value);
        } catch (Exception ex) {
            throw new BusinessException(field + " must use HH:mm format.");
        }
    }

    private double durationHours(Shift shift) {
        return Duration.between(shift.getStartAt(), shift.getEndAt()).toMinutes() / 60.0;
    }

    private double round(double value) {
        return Math.round(value * 100.0) / 100.0;
    }

    private boolean isAdmin(User user) {
        return user.getRoles() != null && user.getRoles().stream().anyMatch(role -> "ROLE_ADMIN".equals(role.getName()));
    }

    private void audit(String eventType, String entityId, User actor, Map<String, Object> details) {
        jdbcTemplate.update("INSERT INTO audit_events (event_type, entity_type, entity_id, actor, details) VALUES (?, ?, ?, ?, ?::jsonb)",
                eventType, "SHIFT", entityId, actor == null ? "system" : actor.getEmail(), toJson(details));
    }

    private String toJson(Map<String, Object> details) {
        return details.entrySet().stream()
                .map(entry -> "\"" + entry.getKey() + "\":\"" + String.valueOf(entry.getValue()).replace("\"", "\\\"") + "\"")
                .reduce("{", (left, right) -> left.equals("{") ? left + right : left + "," + right) + "}";
    }

    ShiftImportBatch saveImportBatch(ShiftImportBatch batch) {
        return importBatchRepository.save(batch);
    }
}
