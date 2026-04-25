package com.example.shop.modules.attendance.service;

import com.example.shop.modules.user.entity.User;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Types;
import java.time.Instant;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class AttendanceService {

    private static final long MINUTE_MS = 60_000L;
    private static final long DAY_MS = 24L * 60L * 60L * 1000L;
    private static final DateTimeFormatter DATE_KEY_FORMATTER = DateTimeFormatter.ofPattern("yyyy-MM-dd");

    private final JdbcTemplate jdbcTemplate;

    @Value("${ATTENDANCE_TIMEZONE:UTC}")
    private String attendanceTimezone;

    public enum AttendanceAction {
        CLOCK_IN,
        CLOCK_OUT,
        START_BREAK,
        END_BREAK;

        public static AttendanceAction fromWire(String raw) {
            if (!StringUtils.hasText(raw)) {
                throw new IllegalArgumentException(
                        "Invalid action. Use one of: clock_in, clock_out, start_break, end_break.");
            }
            return switch (raw.trim().toLowerCase(Locale.ROOT)) {
                case "clock_in" -> CLOCK_IN;
                case "clock_out" -> CLOCK_OUT;
                case "start_break" -> START_BREAK;
                case "end_break" -> END_BREAK;
                default -> throw new IllegalArgumentException(
                        "Invalid action. Use one of: clock_in, clock_out, start_break, end_break.");
            };
        }
    }

    public record EmployeeIdentity(String email, String displayName, String role, String userId) {}

    public record AttendanceSnapshot(
            EmployeeSummary employee,
            String timezone,
            long generatedAt,
            String status,
            boolean onBreak,
            OpenShiftInfo openShift,
            long liveWorkedMinutes,
            long liveBreakMinutes,
            long todayTotalMinutes,
            long weekTotalMinutes,
            List<SnapshotShift> recentShifts
    ) {}

    public record EmployeeSummary(String email, String name, String role, String userId) {}

    public record OpenShiftInfo(String shiftId, long clockInAt, String shiftDate) {}

    public record SnapshotShift(
            String shiftId,
            String shiftDate,
            long clockInAt,
            Long clockOutAt,
            long totalWorkMinutes,
            long totalBreakMinutes,
            String status,
            String note
    ) {}

    public record AdminAttendanceSnapshot(
            String timezone,
            long generatedAt,
            AdminAttendanceSummary summary,
            List<AdminAttendanceRecord> activeShifts,
            List<AdminAttendanceRecord> records
    ) {}

    public record AdminAttendanceSummary(
            long employeesTracked,
            long activeEmployees,
            long employeesOnBreak,
            long todayWorkedMinutes,
            long weekWorkedMinutes
    ) {}

    public record AdminAttendanceRecord(
            String shiftId,
            String shiftDate,
            EmployeeSummary employee,
            long clockInAt,
            Long clockOutAt,
            long totalWorkMinutes,
            long totalBreakMinutes,
            String status,
            String note
    ) {}

    public record AdminAttendanceFilters(
            String query,
            String status,
            String dateFrom,
            String dateTo,
            int limit
    ) {}

    private record AttendanceShiftRow(
            String shiftId,
            String employeeEmail,
            String employeeName,
            String employeeRole,
            String employeeUserId,
            String shiftDate,
            long clockInAt,
            Long clockOutAt,
            long totalWorkMinutes,
            long totalBreakMinutes,
            String note
    ) {}

    private record AttendanceBreakRow(
            String breakId,
            String shiftId,
            long startedAt,
            Long endedAt,
            long durationMinutes
    ) {}

    private record SummaryRow(long employeesTracked, long activeEmployees, long employeesOnBreak) {}

    private record AdminAttendanceShiftRow(AttendanceShiftRow shift, boolean hasOpenBreak) {}

    public AttendanceSnapshot getAttendanceSnapshot(User user) {
        ensureAttendanceTables();
        return buildSnapshot(resolveEmployee(user), System.currentTimeMillis());
    }

    @Transactional
    public AttendanceSnapshot applyAttendanceAction(User user, AttendanceAction action, String rawNote) {
        ensureAttendanceTables();
        EmployeeIdentity employee = resolveEmployee(user);
        String note = sanitizeNote(rawNote);
        long now = System.currentTimeMillis();

        AttendanceShiftRow openShift = getOpenShift(employee.userId());

        if (action == AttendanceAction.CLOCK_IN) {
            if (openShift != null) {
                throw new IllegalStateException("You already have an active shift. Clock out before starting a new one.");
            }

            String shiftId = makeId("shift");
            jdbcTemplate.update(
                    """
                    INSERT INTO attendance_shifts (
                      shift_id,
                      employee_email,
                      employee_name,
                      employee_role,
                      employee_user_id,
                      shift_date,
                      clock_in_at,
                      clock_out_at,
                      total_work_minutes,
                      total_break_minutes,
                      note,
                      created_at,
                      updated_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, NULL, 0, 0, ?, ?, ?)
                    """,
                    shiftId,
                    employee.email(),
                    employee.displayName(),
                    employee.role(),
                    employee.userId(),
                    dateKeyFromTimestamp(now),
                    now,
                    note,
                    now,
                    now
            );
        }

        if (action == AttendanceAction.START_BREAK) {
            if (openShift == null) {
                throw new IllegalStateException("No active shift. Clock in before starting a break.");
            }

            List<AttendanceBreakRow> existingBreaks = getShiftBreaks(openShift.shiftId());
            boolean hasOpenBreak = existingBreaks.stream().anyMatch(currentBreak -> currentBreak.endedAt() == null);
            if (hasOpenBreak) {
                throw new IllegalStateException("A break is already active. End the current break first.");
            }

            String breakId = makeId("break");
            jdbcTemplate.update(
                    """
                    INSERT INTO attendance_breaks (
                      break_id,
                      shift_id,
                      started_at,
                      ended_at,
                      duration_minutes,
                      created_at,
                      updated_at
                    ) VALUES (?, ?, ?, NULL, 0, ?, ?)
                    """,
                    breakId,
                    openShift.shiftId(),
                    now,
                    now,
                    now
            );
        }

        if (action == AttendanceAction.END_BREAK) {
            if (openShift == null) {
                throw new IllegalStateException("No active shift. Clock in before ending a break.");
            }

            List<AttendanceBreakRow> breakRows = jdbcTemplate.query(
                    """
                    SELECT *
                      FROM attendance_breaks
                     WHERE shift_id = ?
                       AND ended_at IS NULL
                     ORDER BY started_at DESC
                     LIMIT 1
                    """,
                    attendanceBreakRowMapper(),
                    openShift.shiftId()
            );

            AttendanceBreakRow activeBreak = breakRows.isEmpty() ? null : breakRows.getFirst();
            if (activeBreak == null) {
                throw new IllegalStateException("No active break found.");
            }

            long breakDurationMinutes = minutesBetween(activeBreak.startedAt(), now);
            jdbcTemplate.update(
                    """
                    UPDATE attendance_breaks
                       SET ended_at = ?,
                           duration_minutes = ?,
                           updated_at = ?
                     WHERE break_id = ?
                    """,
                    now,
                    breakDurationMinutes,
                    now,
                    activeBreak.breakId()
            );
        }

        if (action == AttendanceAction.CLOCK_OUT) {
            if (openShift == null) {
                throw new IllegalStateException("No active shift. Clock in first.");
            }

            List<AttendanceBreakRow> allBreaks = getShiftBreaks(openShift.shiftId());
            AttendanceBreakRow activeBreak = allBreaks.stream()
                    .filter(currentBreak -> currentBreak.endedAt() == null)
                    .findFirst()
                    .orElse(null);
            if (activeBreak != null) {
                long activeDurationMinutes = minutesBetween(activeBreak.startedAt(), now);
                jdbcTemplate.update(
                        """
                        UPDATE attendance_breaks
                           SET ended_at = ?,
                               duration_minutes = ?,
                               updated_at = ?
                         WHERE break_id = ?
                        """,
                        now,
                        activeDurationMinutes,
                        now,
                        activeBreak.breakId()
                );
            }

            List<AttendanceBreakRow> finalBreaks = getShiftBreaks(openShift.shiftId());
            long totalBreakMinutes = sumBreakMinutes(finalBreaks, now);
            long totalWorkMinutes = Math.max(0L, minutesBetween(openShift.clockInAt(), now) - totalBreakMinutes);

            jdbcTemplate.update(
                    """
                    UPDATE attendance_shifts
                       SET clock_out_at = ?,
                           total_work_minutes = ?,
                           total_break_minutes = ?,
                           note = COALESCE(?, note),
                           updated_at = ?
                     WHERE shift_id = ?
                    """,
                    now,
                    totalWorkMinutes,
                    totalBreakMinutes,
                    note,
                    now,
                    openShift.shiftId()
            );
        }

        return buildSnapshot(employee, now);
    }

    public AdminAttendanceSnapshot getAdminAttendanceSnapshot(AdminAttendanceFilters rawFilters) {
        ensureAttendanceTables();

        long now = System.currentTimeMillis();
        String todayKey = dateKeyFromTimestamp(now);
        long weekCutoff = now - 6L * DAY_MS;
        String query = rawFilters.query() == null ? "" : rawFilters.query().trim();
        if (query.length() > 120) {
            query = query.substring(0, 120);
        }
        String status = StringUtils.hasText(rawFilters.status()) ? rawFilters.status().trim().toLowerCase(Locale.ROOT) : "all";
        String dateFrom = sanitizeDateInput(rawFilters.dateFrom());
        String dateTo = sanitizeDateInput(rawFilters.dateTo());
        int limit = Math.max(1, Math.min(100, rawFilters.limit() <= 0 ? 50 : rawFilters.limit()));

        SummaryRow summary = jdbcTemplate.queryForObject(
                """
                SELECT
                  COUNT(DISTINCT s.employee_user_id) AS employees_tracked,
                  COALESCE(SUM(CASE WHEN s.clock_out_at IS NULL THEN 1 ELSE 0 END), 0) AS active_employees,
                  COALESCE(SUM(
                    CASE
                      WHEN s.clock_out_at IS NULL
                       AND EXISTS (
                         SELECT 1
                           FROM attendance_breaks b
                          WHERE b.shift_id = s.shift_id
                            AND b.ended_at IS NULL
                       )
                      THEN 1
                      ELSE 0
                    END
                  ), 0) AS employees_on_break
                FROM attendance_shifts s
                """,
                (rs, rowNum) -> new SummaryRow(
                        rs.getLong("employees_tracked"),
                        rs.getLong("active_employees"),
                        rs.getLong("employees_on_break")
                )
        );

        List<AttendanceShiftRow> workRows = jdbcTemplate.query(
                """
                SELECT *
                  FROM attendance_shifts
                 WHERE shift_date = ?
                    OR clock_out_at IS NULL
                    OR clock_in_at >= ?
                 ORDER BY clock_in_at DESC
                """,
                attendanceShiftRowMapper(),
                todayKey,
                weekCutoff
        );

        long todayWorkedMinutes = 0L;
        long weekWorkedMinutes = 0L;

        for (AttendanceShiftRow shift : workRows) {
            long workedMinutes = shift.totalWorkMinutes();
            if (shift.clockOutAt() == null) {
                List<AttendanceBreakRow> breaks = getShiftBreaks(shift.shiftId());
                workedMinutes = Math.max(0L, minutesBetween(shift.clockInAt(), now) - sumBreakMinutes(breaks, now));
            }

            if (todayKey.equals(shift.shiftDate())) {
                todayWorkedMinutes += workedMinutes;
            }
            if (shift.clockInAt() >= weekCutoff) {
                weekWorkedMinutes += workedMinutes;
            }
        }

        StringBuilder recordsSql = new StringBuilder(
                """
                SELECT
                  s.*,
                  CASE
                    WHEN s.clock_out_at IS NULL
                     AND EXISTS (
                       SELECT 1
                         FROM attendance_breaks b
                        WHERE b.shift_id = s.shift_id
                          AND b.ended_at IS NULL
                     )
                    THEN 1
                    ELSE 0
                  END AS has_open_break
                FROM attendance_shifts s
                WHERE 1 = 1
                """
        );
        List<Object> params = new ArrayList<>();
        List<Integer> paramTypes = new ArrayList<>();

        if (StringUtils.hasText(query)) {
            recordsSql.append(" AND (LOWER(s.employee_name) LIKE ? OR LOWER(s.employee_email) LIKE ?)");
            String value = "%" + query.toLowerCase(Locale.ROOT) + "%";
            params.add(value);
            paramTypes.add(Types.VARCHAR);
            params.add(value);
            paramTypes.add(Types.VARCHAR);
        }
        if (dateFrom != null) {
            recordsSql.append(" AND s.shift_date >= ?");
            params.add(dateFrom);
            paramTypes.add(Types.VARCHAR);
        }
        if (dateTo != null) {
            recordsSql.append(" AND s.shift_date <= ?");
            params.add(dateTo);
            paramTypes.add(Types.VARCHAR);
        }
        if ("active".equals(status)) {
            recordsSql.append(" AND s.clock_out_at IS NULL");
        } else if ("closed".equals(status)) {
            recordsSql.append(" AND s.clock_out_at IS NOT NULL");
        } else if ("on_break".equals(status)) {
            recordsSql.append(
                    """
                     AND s.clock_out_at IS NULL
                     AND EXISTS (
                       SELECT 1
                         FROM attendance_breaks bx
                        WHERE bx.shift_id = s.shift_id
                          AND bx.ended_at IS NULL
                     )
                    """
            );
        }
        recordsSql.append(" ORDER BY s.clock_in_at DESC LIMIT ?");
        params.add(limit);
        paramTypes.add(Types.INTEGER);

        List<AdminAttendanceShiftRow> recordRows = jdbcTemplate.query(
                recordsSql.toString(),
                params.toArray(),
                paramTypes.stream().mapToInt(Integer::intValue).toArray(),
                adminAttendanceShiftRowMapper()
        );

        List<AdminAttendanceShiftRow> activeRows = jdbcTemplate.query(
                """
                SELECT
                  s.*,
                  CASE
                    WHEN EXISTS (
                      SELECT 1
                        FROM attendance_breaks b
                       WHERE b.shift_id = s.shift_id
                         AND b.ended_at IS NULL
                    )
                    THEN 1
                    ELSE 0
                  END AS has_open_break
                FROM attendance_shifts s
                WHERE s.clock_out_at IS NULL
                ORDER BY s.clock_in_at DESC
                LIMIT 10
                """,
                adminAttendanceShiftRowMapper()
        );

        List<AdminAttendanceRecord> activeShifts = activeRows.stream()
                .map(row -> toComputedAdminRecord(row.shift(), now, row.hasOpenBreak()))
                .toList();
        List<AdminAttendanceRecord> records = recordRows.stream()
                .map(row -> toComputedAdminRecord(row.shift(), now, row.hasOpenBreak()))
                .toList();

        return new AdminAttendanceSnapshot(
                attendanceTimezone,
                now,
                new AdminAttendanceSummary(
                        summary == null ? 0L : summary.employeesTracked(),
                        summary == null ? 0L : summary.activeEmployees(),
                        summary == null ? 0L : summary.employeesOnBreak(),
                        todayWorkedMinutes,
                        weekWorkedMinutes
                ),
                activeShifts,
                records
        );
    }

    private AttendanceSnapshot buildSnapshot(EmployeeIdentity employee, long now) {
        List<AttendanceShiftRow> recentRows = jdbcTemplate.query(
                """
                SELECT *
                  FROM attendance_shifts
                 WHERE employee_user_id = ?
                 ORDER BY clock_in_at DESC
                 LIMIT 25
                """,
                attendanceShiftRowMapper(),
                employee.userId()
        );

        AttendanceShiftRow openShift = recentRows.stream()
                .filter(row -> row.clockOutAt() == null)
                .findFirst()
                .orElse(null);

        List<AttendanceBreakRow> openShiftBreaks = openShift == null ? List.of() : getShiftBreaks(openShift.shiftId());
        boolean hasOpenBreak = openShiftBreaks.stream().anyMatch(currentBreak -> currentBreak.endedAt() == null);

        long openShiftBreakMinutes = sumBreakMinutes(openShiftBreaks, now);
        long liveWorkedMinutes = openShift == null
                ? 0L
                : Math.max(0L, minutesBetween(openShift.clockInAt(), now) - openShiftBreakMinutes);

        String todayKey = dateKeyFromTimestamp(now);
        long todayTotalMinutes = 0L;
        long weekTotalMinutes = 0L;
        long weekCutoff = now - 6L * DAY_MS;

        for (AttendanceShiftRow shift : recentRows) {
            long workedMinutes = shift.clockOutAt() == null ? liveWorkedMinutes : shift.totalWorkMinutes();
            if (todayKey.equals(shift.shiftDate())) {
                todayTotalMinutes += workedMinutes;
            }
            if (shift.clockInAt() >= weekCutoff) {
                weekTotalMinutes += workedMinutes;
            }
        }

        return new AttendanceSnapshot(
                new EmployeeSummary(employee.email(), employee.displayName(), employee.role(), employee.userId()),
                attendanceTimezone,
                now,
                openShift == null ? "CLOCKED_OUT" : "CLOCKED_IN",
                hasOpenBreak,
                openShift == null ? null : new OpenShiftInfo(openShift.shiftId(), openShift.clockInAt(), openShift.shiftDate()),
                liveWorkedMinutes,
                openShift == null ? 0L : openShiftBreakMinutes,
                todayTotalMinutes,
                weekTotalMinutes,
                recentRows.stream().map(this::toShiftView).toList()
        );
    }

    private AdminAttendanceRecord toComputedAdminRecord(
            AttendanceShiftRow shift,
            long now,
            boolean hasOpenBreakOverride
    ) {
        if (shift.clockOutAt() != null) {
            return toAdminRecord(shift, hasOpenBreakOverride);
        }

        List<AttendanceBreakRow> breaks = getShiftBreaks(shift.shiftId());
        long totalBreakMinutes = sumBreakMinutes(breaks, now);
        long totalWorkMinutes = Math.max(0L, minutesBetween(shift.clockInAt(), now) - totalBreakMinutes);
        boolean hasOpenBreak = breaks.stream().anyMatch(currentBreak -> currentBreak.endedAt() == null) || hasOpenBreakOverride;

        return new AdminAttendanceRecord(
                shift.shiftId(),
                shift.shiftDate(),
                new EmployeeSummary(shift.employeeEmail(), shift.employeeName(), shift.employeeRole(), shift.employeeUserId()),
                shift.clockInAt(),
                shift.clockOutAt(),
                totalWorkMinutes,
                totalBreakMinutes,
                toAdminShiftStatus(shift, hasOpenBreak),
                shift.note()
        );
    }

    private AdminAttendanceRecord toAdminRecord(AttendanceShiftRow shift, boolean hasOpenBreak) {
        return new AdminAttendanceRecord(
                shift.shiftId(),
                shift.shiftDate(),
                new EmployeeSummary(shift.employeeEmail(), shift.employeeName(), shift.employeeRole(), shift.employeeUserId()),
                shift.clockInAt(),
                shift.clockOutAt(),
                shift.totalWorkMinutes(),
                shift.totalBreakMinutes(),
                toAdminShiftStatus(shift, hasOpenBreak),
                shift.note()
        );
    }

    private SnapshotShift toShiftView(AttendanceShiftRow shift) {
        return new SnapshotShift(
                shift.shiftId(),
                shift.shiftDate(),
                shift.clockInAt(),
                shift.clockOutAt(),
                shift.totalWorkMinutes(),
                shift.totalBreakMinutes(),
                shift.clockOutAt() == null ? "open" : "closed",
                shift.note()
        );
    }

    private String toAdminShiftStatus(AttendanceShiftRow shift, boolean hasOpenBreak) {
        if (shift.clockOutAt() != null) {
            return "CLOCKED_OUT";
        }
        return hasOpenBreak ? "ON_BREAK" : "CLOCKED_IN";
    }

    private List<AttendanceBreakRow> getShiftBreaks(String shiftId) {
        return jdbcTemplate.query(
                """
                SELECT *
                  FROM attendance_breaks
                 WHERE shift_id = ?
                 ORDER BY started_at ASC
                """,
                attendanceBreakRowMapper(),
                shiftId
        );
    }

    private AttendanceShiftRow getOpenShift(String employeeUserId) {
        List<AttendanceShiftRow> rows = jdbcTemplate.query(
                """
                SELECT *
                  FROM attendance_shifts
                 WHERE employee_user_id = ?
                   AND clock_out_at IS NULL
                 ORDER BY clock_in_at DESC
                 LIMIT 1
                """,
                attendanceShiftRowMapper(),
                employeeUserId
        );
        return rows.isEmpty() ? null : rows.getFirst();
    }

    private void ensureAttendanceTables() {
        jdbcTemplate.execute(
                """
                CREATE TABLE IF NOT EXISTS attendance_shifts (
                  shift_id VARCHAR(64) PRIMARY KEY,
                  employee_email VARCHAR(255) NOT NULL,
                  employee_name VARCHAR(255) NOT NULL,
                  employee_role VARCHAR(50) NOT NULL,
                  employee_user_id VARCHAR(64) NOT NULL,
                  shift_date VARCHAR(10) NOT NULL,
                  clock_in_at BIGINT NOT NULL,
                  clock_out_at BIGINT NULL,
                  total_work_minutes INT NOT NULL DEFAULT 0,
                  total_break_minutes INT NOT NULL DEFAULT 0,
                  note TEXT NULL,
                  created_at BIGINT NOT NULL,
                  updated_at BIGINT NOT NULL
                )
                """
        );
        jdbcTemplate.execute(
                """
                CREATE TABLE IF NOT EXISTS attendance_breaks (
                  break_id VARCHAR(64) PRIMARY KEY,
                  shift_id VARCHAR(64) NOT NULL,
                  started_at BIGINT NOT NULL,
                  ended_at BIGINT NULL,
                  duration_minutes INT NOT NULL DEFAULT 0,
                  created_at BIGINT NOT NULL,
                  updated_at BIGINT NOT NULL
                )
                """
        );
    }

    private EmployeeIdentity resolveEmployee(User user) {
        if (user == null) {
            throw new IllegalStateException("Missing authentication headers.");
        }

        List<String> roles = user.getAuthorities() == null
                ? List.of()
                : user.getAuthorities().stream().map(authority -> authority.getAuthority().toUpperCase(Locale.ROOT)).toList();
        boolean allowed = roles.contains("ROLE_EMPLOYEE") || roles.contains("ROLE_ADMIN") || roles.contains("ROLE_STAFF");
        if (!allowed) {
            throw new IllegalStateException("Forbidden. Attendance is for employees and admins only.");
        }

        String displayName = ((user.getFirstName() == null ? "" : user.getFirstName()) + " " +
                (user.getLastName() == null ? "" : user.getLastName())).trim();
        if (!StringUtils.hasText(displayName)) {
            displayName = user.getEmail();
        }
        String normalizedRole = roles.contains("ROLE_ADMIN") ? "admin"
                : roles.contains("ROLE_EMPLOYEE") || roles.contains("ROLE_STAFF") ? "employee"
                : "employee";

        UUID userId = user.getId();
        return new EmployeeIdentity(
                user.getEmail(),
                displayName,
                normalizedRole,
                userId == null ? user.getEmail() : userId.toString()
        );
    }

    private String sanitizeNote(String note) {
        if (!StringUtils.hasText(note)) {
            return null;
        }
        String trimmed = note.trim();
        return trimmed.length() > 400 ? trimmed.substring(0, 400) : trimmed;
    }

    private String sanitizeDateInput(String value) {
        if (!StringUtils.hasText(value)) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.matches("\\d{4}-\\d{2}-\\d{2}") ? trimmed : null;
    }

    private String dateKeyFromTimestamp(long timestamp) {
        ZoneId zoneId = ZoneId.of(attendanceTimezone);
        return DATE_KEY_FORMATTER.format(Instant.ofEpochMilli(timestamp).atZone(zoneId).toLocalDate());
    }

    private long minutesBetween(long startMs, long endMs) {
        if (endMs <= startMs) {
            return 0L;
        }
        return (endMs - startMs) / MINUTE_MS;
    }

    private long sumBreakMinutes(List<AttendanceBreakRow> breaks, long now) {
        long total = 0L;
        for (AttendanceBreakRow currentBreak : breaks) {
            long endAt = currentBreak.endedAt() == null ? now : currentBreak.endedAt();
            total += minutesBetween(currentBreak.startedAt(), endAt);
        }
        return total;
    }

    private String makeId(String prefix) {
        return prefix + "_" + System.currentTimeMillis() + "_" + UUID.randomUUID().toString().replace("-", "").substring(0, 8);
    }

    private RowMapper<AttendanceShiftRow> attendanceShiftRowMapper() {
        return (rs, rowNum) -> new AttendanceShiftRow(
                rs.getString("shift_id"),
                rs.getString("employee_email"),
                rs.getString("employee_name"),
                rs.getString("employee_role"),
                rs.getString("employee_user_id"),
                rs.getString("shift_date"),
                rs.getLong("clock_in_at"),
                getNullableLong(rs, "clock_out_at"),
                rs.getLong("total_work_minutes"),
                rs.getLong("total_break_minutes"),
                rs.getString("note")
        );
    }

    private RowMapper<AttendanceBreakRow> attendanceBreakRowMapper() {
        return (rs, rowNum) -> new AttendanceBreakRow(
                rs.getString("break_id"),
                rs.getString("shift_id"),
                rs.getLong("started_at"),
                getNullableLong(rs, "ended_at"),
                rs.getLong("duration_minutes")
        );
    }

    private RowMapper<AdminAttendanceShiftRow> adminAttendanceShiftRowMapper() {
        return (rs, rowNum) -> new AdminAttendanceShiftRow(
                attendanceShiftRowMapper().mapRow(rs, rowNum),
                rs.getInt("has_open_break") == 1
        );
    }

    private Long getNullableLong(ResultSet rs, String column) throws SQLException {
        long value = rs.getLong(column);
        return rs.wasNull() ? null : value;
    }
}
