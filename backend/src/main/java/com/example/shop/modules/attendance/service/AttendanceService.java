package com.example.shop.modules.attendance.service;

import com.example.shop.common.mail.EmailService;
import com.example.shop.common.mail.EmailTemplateService;
import com.example.shop.modules.user.entity.User;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Types;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Collection;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class AttendanceService {

    private static final long MINUTE_MS = 60_000L;
    private static final long DAY_MS = 24L * 60L * 60L * 1000L;
    private static final String REVIEW_STATUS_OPEN = "OPEN";
    private static final String REVIEW_STATUS_ACKNOWLEDGED = "ACKNOWLEDGED";
    private static final String REVIEW_STATUS_RESOLVED = "RESOLVED";
    private static final String REVIEW_TYPE_WARNING = "WARNING";
    private static final String REVIEW_TYPE_REPRIMAND = "REPRIMAND";
    private static final String REVIEW_TYPE_NEGATIVE = "NEGATIVE_REVIEW";
    private static final String CATEGORY_ATTENDANCE = "ATTENDANCE";
    private static final String CATEGORY_LONG_BREAK = "LONG_BREAK";
    private static final String CATEGORY_LOW_HOURS = "LOW_HOURS";
    private static final String CATEGORY_MANUAL = "MANUAL";
    private static final String SYSTEM_ACTOR = "system";
    private static final DateTimeFormatter DATE_KEY_FORMATTER = DateTimeFormatter.ofPattern("yyyy-MM-dd");

    private final JdbcTemplate jdbcTemplate;
    private final EmailService emailService;
    private final EmailTemplateService emailTemplateService;

    @Value("${ATTENDANCE_TIMEZONE:UTC}")
    private String attendanceTimezone;

    @Value("${application.attendance.monitor.enabled:true}")
    private boolean attendanceMonitorEnabled;

    @Value("${application.attendance.policy.long-break-minutes:30}")
    private int longBreakMinutes;

    @Value("${application.attendance.policy.break-reminder-interval-minutes:30}")
    private int breakReminderIntervalMinutes;

    @Value("${application.attendance.policy.min-daily-work-minutes:480}")
    private int minDailyWorkMinutes;

    @Value("${application.attendance.policy.low-hours-reminder-after-local-hour:16}")
    private int lowHoursReminderAfterLocalHour;

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

    public record AttendancePolicySnapshot(
            boolean monitorEnabled,
            int longBreakMinutes,
            int breakReminderIntervalMinutes,
            int minDailyWorkMinutes,
            int lowHoursReminderAfterLocalHour
    ) {}

    public record AdminPerformanceSummary(
            long totalReviews,
            long openReviews,
            long warningCount,
            long reprimandCount
    ) {}

    public record AdminPerformanceReview(
            String reviewId,
            String employeeUserId,
            String employeeEmail,
            String employeeName,
            String reviewType,
            String category,
            String title,
            String summary,
            String status,
            String relatedShiftId,
            Long lastNotifiedAt,
            int notificationCount,
            String createdBy,
            long createdAt,
            long updatedAt
    ) {}

    public record AdminAttendanceSnapshot(
            String timezone,
            long generatedAt,
            AttendancePolicySnapshot policy,
            AdminAttendanceSummary summary,
            AdminPerformanceSummary performanceSummary,
            List<AdminAttendanceRecord> activeShifts,
            List<AdminAttendanceRecord> records,
            List<AdminPerformanceReview> performanceReviews
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
            String note,
            int warningCount,
            int reprimandCount,
            int openIssueCount
    ) {}

    public record AdminAttendanceFilters(
            String query,
            String status,
            String dateFrom,
            String dateTo,
            String reviewStatus,
            int limit
    ) {}

    public record AdminPerformanceReviewRequest(
            String employeeUserId,
            String employeeEmail,
            String employeeName,
            String reviewType,
            String category,
            String title,
            String summary,
            String relatedShiftId,
            boolean sendEmail
    ) {}

    public record AdminPerformanceReviewUpdateRequest(
            String status,
            String title,
            String summary,
            boolean resendEmail
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

    private record EmployeeReviewCounts(int warningCount, int reprimandCount, int openIssueCount) {}

    private record PerformanceReviewRow(
            String reviewId,
            String employeeUserId,
            String employeeEmail,
            String employeeName,
            String reviewType,
            String category,
            String title,
            String summary,
            String status,
            String relatedShiftId,
            String sourceKey,
            Long lastNotifiedAt,
            int notificationCount,
            String createdByUserId,
            String createdByEmail,
            long createdAt,
            long updatedAt
    ) {}

    private record OpenBreakMonitorRow(AttendanceShiftRow shift, long activeBreakStartedAt) {}

    private record DailyWorkMonitorRow(
            String employeeUserId,
            String employeeEmail,
            String employeeName,
            String employeeRole,
            String shiftDate,
            long workedMinutes
    ) {}

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
        String query = sanitizeQuery(rawFilters.query(), 120);
        String status = normalizeAttendanceStatus(rawFilters.status());
        String dateFrom = sanitizeDateInput(rawFilters.dateFrom());
        String dateTo = sanitizeDateInput(rawFilters.dateTo());
        String reviewStatus = normalizeReviewStatusFilter(rawFilters.reviewStatus());
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

        Map<String, EmployeeReviewCounts> reviewCounts = loadEmployeeReviewCounts(collectEmployeeIds(activeRows, recordRows));
        List<AdminAttendanceRecord> activeShifts = activeRows.stream()
                .map(row -> toComputedAdminRecord(row.shift(), now, row.hasOpenBreak(), reviewCounts))
                .toList();
        List<AdminAttendanceRecord> records = recordRows.stream()
                .map(row -> toComputedAdminRecord(row.shift(), now, row.hasOpenBreak(), reviewCounts))
                .toList();

        List<AdminPerformanceReview> performanceReviews = listPerformanceReviews(query, reviewStatus, limit);
        AdminPerformanceSummary performanceSummary = loadPerformanceSummary();

        return new AdminAttendanceSnapshot(
                attendanceTimezone,
                now,
                new AttendancePolicySnapshot(
                        attendanceMonitorEnabled,
                        Math.max(1, longBreakMinutes),
                        Math.max(1, breakReminderIntervalMinutes),
                        Math.max(1, minDailyWorkMinutes),
                        Math.max(0, lowHoursReminderAfterLocalHour)
                ),
                new AdminAttendanceSummary(
                        summary == null ? 0L : summary.employeesTracked(),
                        summary == null ? 0L : summary.activeEmployees(),
                        summary == null ? 0L : summary.employeesOnBreak(),
                        todayWorkedMinutes,
                        weekWorkedMinutes
                ),
                performanceSummary,
                activeShifts,
                records,
                performanceReviews
        );
    }

    @Transactional
    public AdminPerformanceReview createAdminPerformanceReview(User actor, AdminPerformanceReviewRequest request) {
        ensureAttendanceTables();
        EmployeeIdentity admin = resolveAdminActor(actor);
        EmployeeIdentity employee = resolveTargetEmployee(request.employeeUserId(), request.employeeEmail(), request.employeeName());
        String reviewType = normalizeReviewType(request.reviewType());
        String category = normalizeCategory(request.category(), CATEGORY_MANUAL);
        String title = sanitizeRequiredText(request.title(), 160, "Title is required.");
        String summary = sanitizeRequiredText(request.summary(), 2000, "Summary is required.");
        String relatedShiftId = sanitizeOptionalText(request.relatedShiftId(), 64);
        long now = System.currentTimeMillis();
        String reviewId = makeId("review");
        Long lastNotifiedAt = null;
        int notificationCount = 0;

        if (request.sendEmail()) {
            sendPerformanceEmail(employee, title, summary, category, reviewType);
            lastNotifiedAt = now;
            notificationCount = 1;
        }

        jdbcTemplate.update(
                """
                INSERT INTO employee_performance_reviews (
                  review_id,
                  employee_user_id,
                  employee_email,
                  employee_name,
                  review_type,
                  category,
                  title,
                  summary,
                  review_status,
                  related_shift_id,
                  source_key,
                  last_notified_at,
                  notification_count,
                  created_by_user_id,
                  created_by_email,
                  created_at,
                  updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?, ?, ?, ?)
                """,
                reviewId,
                employee.userId(),
                employee.email(),
                employee.displayName(),
                reviewType,
                category,
                title,
                summary,
                REVIEW_STATUS_OPEN,
                relatedShiftId,
                lastNotifiedAt,
                notificationCount,
                admin.userId(),
                admin.email(),
                now,
                now
        );

        return requirePerformanceReview(reviewId);
    }

    @Transactional
    public AdminPerformanceReview updateAdminPerformanceReview(
            User actor,
            String reviewId,
            AdminPerformanceReviewUpdateRequest request
    ) {
        ensureAttendanceTables();
        resolveAdminActor(actor);
        String normalizedReviewId = sanitizeRequiredText(reviewId, 64, "Review id is required.");
        PerformanceReviewRow current = requirePerformanceReviewRow(normalizedReviewId);
        String nextStatus = StringUtils.hasText(request.status()) ? normalizeReviewStatus(request.status()) : current.status();
        String nextTitle = StringUtils.hasText(request.title()) ? sanitizeRequiredText(request.title(), 160, "Title is required.") : current.title();
        String nextSummary = StringUtils.hasText(request.summary()) ? sanitizeRequiredText(request.summary(), 2000, "Summary is required.") : current.summary();
        Long lastNotifiedAt = current.lastNotifiedAt();
        int notificationCount = current.notificationCount();
        long now = System.currentTimeMillis();

        if (request.resendEmail()) {
            sendPerformanceEmail(
                    new EmployeeIdentity(current.employeeEmail(), current.employeeName(), "employee", current.employeeUserId()),
                    nextTitle,
                    nextSummary,
                    current.category(),
                    current.reviewType()
            );
            lastNotifiedAt = now;
            notificationCount += 1;
        }

        jdbcTemplate.update(
                """
                UPDATE employee_performance_reviews
                   SET title = ?,
                       summary = ?,
                       review_status = ?,
                       last_notified_at = ?,
                       notification_count = ?,
                       updated_at = ?
                 WHERE review_id = ?
                """,
                nextTitle,
                nextSummary,
                nextStatus,
                lastNotifiedAt,
                notificationCount,
                now,
                normalizedReviewId
        );

        return requirePerformanceReview(normalizedReviewId);
    }

    @Scheduled(fixedDelayString = "${application.attendance.monitor.fixed-delay-ms:900000}")
    @Transactional
    public void runAttendancePolicyMonitor() {
        if (!attendanceMonitorEnabled) {
            return;
        }
        ensureAttendanceTables();

        long now = System.currentTimeMillis();
        try {
            processLongBreakNotifications(now);

            ZonedDateTime localNow = Instant.ofEpochMilli(now).atZone(ZoneId.of(attendanceTimezone));
            if (localNow.getHour() >= Math.max(0, lowHoursReminderAfterLocalHour)) {
                processLowHoursNotifications(now, DATE_KEY_FORMATTER.format(localNow.toLocalDate()));
            }
        } catch (Exception error) {
            log.warn("Attendance policy monitor failed: {}", error.getMessage(), error);
        }
    }

    private void processLongBreakNotifications(long now) {
        int thresholdMinutes = Math.max(1, longBreakMinutes);
        int reminderMinutes = Math.max(1, breakReminderIntervalMinutes);

        List<OpenBreakMonitorRow> rows = jdbcTemplate.query(
                """
                SELECT
                  s.*,
                  b.started_at AS active_break_started_at
                FROM attendance_shifts s
                JOIN attendance_breaks b
                  ON b.shift_id = s.shift_id
                 AND b.ended_at IS NULL
                WHERE s.clock_out_at IS NULL
                ORDER BY b.started_at ASC
                """,
                openBreakMonitorRowMapper()
        );

        for (OpenBreakMonitorRow row : rows) {
            long breakMinutes = minutesBetween(row.activeBreakStartedAt(), now);
            if (breakMinutes < thresholdMinutes) {
                continue;
            }

            String sourceKey = "LONG_BREAK:" + row.shift().shiftId();
            PerformanceReviewRow current = getPerformanceReviewBySourceKey(sourceKey);
            if (current != null && current.lastNotifiedAt() != null
                    && minutesBetween(current.lastNotifiedAt(), now) < reminderMinutes) {
                continue;
            }

            String title = "Break length exceeds policy";
            String summary = "Current break time is " + breakMinutes + " minutes. The configured threshold is "
                    + thresholdMinutes + " minutes. Please return to work or update your manager.";

            sendPerformanceEmail(
                    new EmployeeIdentity(
                            row.shift().employeeEmail(),
                            row.shift().employeeName(),
                            row.shift().employeeRole(),
                            row.shift().employeeUserId()
                    ),
                    title,
                    summary,
                    CATEGORY_LONG_BREAK,
                    REVIEW_TYPE_WARNING
            );

            upsertAutomatedReview(
                    current,
                    new EmployeeIdentity(
                            row.shift().employeeEmail(),
                            row.shift().employeeName(),
                            row.shift().employeeRole(),
                            row.shift().employeeUserId()
                    ),
                    REVIEW_TYPE_WARNING,
                    CATEGORY_LONG_BREAK,
                    title,
                    summary,
                    row.shift().shiftId(),
                    sourceKey,
                    now
            );
        }
    }

    private void processLowHoursNotifications(long now, String todayKey) {
        int minimumMinutes = Math.max(1, minDailyWorkMinutes);
        int reminderMinutes = Math.max(1, breakReminderIntervalMinutes);

        List<DailyWorkMonitorRow> rows = jdbcTemplate.query(
                """
                SELECT
                  s.employee_user_id,
                  MAX(s.employee_email) AS employee_email,
                  MAX(s.employee_name) AS employee_name,
                  MAX(s.employee_role) AS employee_role,
                  s.shift_date,
                  COALESCE(SUM(
                    CASE
                      WHEN s.clock_out_at IS NULL THEN GREATEST(((? - s.clock_in_at) / 60000) - (
                        SELECT COALESCE(SUM(
                          CASE
                            WHEN b.ended_at IS NULL THEN ((? - b.started_at) / 60000)
                            ELSE b.duration_minutes
                          END
                        ), 0)
                        FROM attendance_breaks b
                        WHERE b.shift_id = s.shift_id
                      ), 0)
                      ELSE s.total_work_minutes
                    END
                  ), 0) AS worked_minutes
                FROM attendance_shifts s
                WHERE s.shift_date = ?
                GROUP BY s.employee_user_id, s.shift_date
                """,
                dailyWorkMonitorRowMapper(),
                now,
                now,
                todayKey
        );

        for (DailyWorkMonitorRow row : rows) {
            if (row.workedMinutes() >= minimumMinutes) {
                continue;
            }

            String sourceKey = "LOW_HOURS:" + row.employeeUserId() + ":" + todayKey;
            PerformanceReviewRow current = getPerformanceReviewBySourceKey(sourceKey);
            if (current != null && current.lastNotifiedAt() != null
                    && minutesBetween(current.lastNotifiedAt(), now) < reminderMinutes) {
                continue;
            }

            String title = "Daily hours are below target";
            String summary = "You have recorded " + row.workedMinutes() + " work minutes today. The minimum target is "
                    + minimumMinutes + " minutes. Please complete your shift or contact your manager if this is expected.";

            sendPerformanceEmail(
                    new EmployeeIdentity(row.employeeEmail(), row.employeeName(), row.employeeRole(), row.employeeUserId()),
                    title,
                    summary,
                    CATEGORY_LOW_HOURS,
                    REVIEW_TYPE_WARNING
            );

            upsertAutomatedReview(
                    current,
                    new EmployeeIdentity(row.employeeEmail(), row.employeeName(), row.employeeRole(), row.employeeUserId()),
                    REVIEW_TYPE_WARNING,
                    CATEGORY_LOW_HOURS,
                    title,
                    summary,
                    null,
                    sourceKey,
                    now
            );
        }
    }

    private void upsertAutomatedReview(
            PerformanceReviewRow current,
            EmployeeIdentity employee,
            String reviewType,
            String category,
            String title,
            String summary,
            String relatedShiftId,
            String sourceKey,
            long now
    ) {
        if (current == null) {
            jdbcTemplate.update(
                    """
                    INSERT INTO employee_performance_reviews (
                      review_id,
                      employee_user_id,
                      employee_email,
                      employee_name,
                      review_type,
                      category,
                      title,
                      summary,
                      review_status,
                      related_shift_id,
                      source_key,
                      last_notified_at,
                      notification_count,
                      created_by_user_id,
                      created_by_email,
                      created_at,
                      updated_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    makeId("review"),
                    employee.userId(),
                    employee.email(),
                    employee.displayName(),
                    reviewType,
                    category,
                    title,
                    summary,
                    REVIEW_STATUS_OPEN,
                    relatedShiftId,
                    sourceKey,
                    now,
                    1,
                    SYSTEM_ACTOR,
                    SYSTEM_ACTOR,
                    now,
                    now
            );
            return;
        }

        jdbcTemplate.update(
                """
                UPDATE employee_performance_reviews
                   SET employee_email = ?,
                       employee_name = ?,
                       review_type = ?,
                       category = ?,
                       title = ?,
                       summary = ?,
                       review_status = ?,
                       related_shift_id = ?,
                       last_notified_at = ?,
                       notification_count = ?,
                       updated_at = ?
                 WHERE review_id = ?
                """,
                employee.email(),
                employee.displayName(),
                reviewType,
                category,
                title,
                summary,
                REVIEW_STATUS_OPEN,
                relatedShiftId,
                now,
                current.notificationCount() + 1,
                now,
                current.reviewId()
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
            boolean hasOpenBreakOverride,
            Map<String, EmployeeReviewCounts> reviewCounts
    ) {
        EmployeeReviewCounts counts = reviewCounts.getOrDefault(
                normalizeLookupKey(shift.employeeUserId(), shift.employeeEmail()),
                new EmployeeReviewCounts(0, 0, 0)
        );

        if (shift.clockOutAt() != null) {
            return toAdminRecord(shift, hasOpenBreakOverride, counts);
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
                shift.note(),
                counts.warningCount(),
                counts.reprimandCount(),
                counts.openIssueCount()
        );
    }

    private AdminAttendanceRecord toAdminRecord(
            AttendanceShiftRow shift,
            boolean hasOpenBreak,
            EmployeeReviewCounts counts
    ) {
        return new AdminAttendanceRecord(
                shift.shiftId(),
                shift.shiftDate(),
                new EmployeeSummary(shift.employeeEmail(), shift.employeeName(), shift.employeeRole(), shift.employeeUserId()),
                shift.clockInAt(),
                shift.clockOutAt(),
                shift.totalWorkMinutes(),
                shift.totalBreakMinutes(),
                toAdminShiftStatus(shift, hasOpenBreak),
                shift.note(),
                counts.warningCount(),
                counts.reprimandCount(),
                counts.openIssueCount()
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

    private Map<String, EmployeeReviewCounts> loadEmployeeReviewCounts(Collection<String> employeeIds) {
        if (employeeIds.isEmpty()) {
            return Map.of();
        }

        StringBuilder placeholders = new StringBuilder();
        List<Object> args = new ArrayList<>();
        for (String employeeId : employeeIds) {
            if (placeholders.length() > 0) {
                placeholders.append(", ");
            }
            placeholders.append("?");
            args.add(employeeId);
        }

        Map<String, EmployeeReviewCounts> counts = new HashMap<>();
        jdbcTemplate.query(
                """
                SELECT
                  employee_user_id,
                  employee_email,
                  COALESCE(SUM(CASE WHEN review_type = 'WARNING' THEN 1 ELSE 0 END), 0) AS warning_count,
                  COALESCE(SUM(CASE WHEN review_type = 'REPRIMAND' THEN 1 ELSE 0 END), 0) AS reprimand_count,
                  COALESCE(SUM(CASE WHEN review_status = 'OPEN' THEN 1 ELSE 0 END), 0) AS open_issue_count
                FROM employee_performance_reviews
                WHERE employee_user_id IN (%s) OR employee_email IN (%s)
                GROUP BY employee_user_id, employee_email
                """.formatted(placeholders, placeholders),
                rs -> counts.put(
                        normalizeLookupKey(rs.getString("employee_user_id"), rs.getString("employee_email")),
                        new EmployeeReviewCounts(
                                rs.getInt("warning_count"),
                                rs.getInt("reprimand_count"),
                                rs.getInt("open_issue_count")
                        )
                ),
                mergeArgs(args, args).toArray()
        );
        return counts;
    }

    private Collection<String> collectEmployeeIds(
            List<AdminAttendanceShiftRow> activeRows,
            List<AdminAttendanceShiftRow> recordRows
    ) {
        Map<String, Boolean> values = new HashMap<>();
        for (AdminAttendanceShiftRow row : activeRows) {
            values.put(normalizeLookupKey(row.shift().employeeUserId(), row.shift().employeeEmail()), true);
        }
        for (AdminAttendanceShiftRow row : recordRows) {
            values.put(normalizeLookupKey(row.shift().employeeUserId(), row.shift().employeeEmail()), true);
        }
        return values.keySet();
    }

    private List<AdminPerformanceReview> listPerformanceReviews(String query, String reviewStatus, int limit) {
        StringBuilder sql = new StringBuilder(
                """
                SELECT *
                  FROM employee_performance_reviews
                 WHERE 1 = 1
                """
        );
        List<Object> params = new ArrayList<>();
        List<Integer> paramTypes = new ArrayList<>();

        if (StringUtils.hasText(query)) {
            sql.append(" AND (LOWER(employee_name) LIKE ? OR LOWER(employee_email) LIKE ? OR LOWER(title) LIKE ? OR LOWER(summary) LIKE ?)");
            String value = "%" + query.toLowerCase(Locale.ROOT) + "%";
            params.add(value);
            paramTypes.add(Types.VARCHAR);
            params.add(value);
            paramTypes.add(Types.VARCHAR);
            params.add(value);
            paramTypes.add(Types.VARCHAR);
            params.add(value);
            paramTypes.add(Types.VARCHAR);
        }
        if (!"all".equals(reviewStatus)) {
            sql.append(" AND review_status = ?");
            params.add(reviewStatus);
            paramTypes.add(Types.VARCHAR);
        }

        sql.append(" ORDER BY updated_at DESC, created_at DESC LIMIT ?");
        params.add(limit);
        paramTypes.add(Types.INTEGER);

        return jdbcTemplate.query(
                sql.toString(),
                params.toArray(),
                paramTypes.stream().mapToInt(Integer::intValue).toArray(),
                performanceReviewRowMapper()
        ).stream().map(this::toAdminPerformanceReview).toList();
    }

    private AdminPerformanceSummary loadPerformanceSummary() {
        return jdbcTemplate.queryForObject(
                """
                SELECT
                  COUNT(*) AS total_reviews,
                  COALESCE(SUM(CASE WHEN review_status = 'OPEN' THEN 1 ELSE 0 END), 0) AS open_reviews,
                  COALESCE(SUM(CASE WHEN review_type = 'WARNING' THEN 1 ELSE 0 END), 0) AS warning_count,
                  COALESCE(SUM(CASE WHEN review_type = 'REPRIMAND' THEN 1 ELSE 0 END), 0) AS reprimand_count
                FROM employee_performance_reviews
                """,
                (rs, rowNum) -> new AdminPerformanceSummary(
                        rs.getLong("total_reviews"),
                        rs.getLong("open_reviews"),
                        rs.getLong("warning_count"),
                        rs.getLong("reprimand_count")
                )
        );
    }

    private PerformanceReviewRow getPerformanceReviewBySourceKey(String sourceKey) {
        if (!StringUtils.hasText(sourceKey)) {
            return null;
        }
        List<PerformanceReviewRow> rows = jdbcTemplate.query(
                """
                SELECT *
                  FROM employee_performance_reviews
                 WHERE source_key = ?
                 ORDER BY updated_at DESC
                 LIMIT 1
                """,
                performanceReviewRowMapper(),
                sourceKey
        );
        return rows.isEmpty() ? null : rows.getFirst();
    }

    private PerformanceReviewRow requirePerformanceReviewRow(String reviewId) {
        List<PerformanceReviewRow> rows = jdbcTemplate.query(
                """
                SELECT *
                  FROM employee_performance_reviews
                 WHERE review_id = ?
                 LIMIT 1
                """,
                performanceReviewRowMapper(),
                reviewId
        );
        if (rows.isEmpty()) {
            throw new IllegalStateException("Performance review not found.");
        }
        return rows.getFirst();
    }

    private AdminPerformanceReview requirePerformanceReview(String reviewId) {
        return toAdminPerformanceReview(requirePerformanceReviewRow(reviewId));
    }

    private AdminPerformanceReview toAdminPerformanceReview(PerformanceReviewRow row) {
        String createdBy = StringUtils.hasText(row.createdByEmail())
                ? row.createdByEmail()
                : (StringUtils.hasText(row.createdByUserId()) ? row.createdByUserId() : SYSTEM_ACTOR);
        return new AdminPerformanceReview(
                row.reviewId(),
                row.employeeUserId(),
                row.employeeEmail(),
                row.employeeName(),
                row.reviewType(),
                row.category(),
                row.title(),
                row.summary(),
                row.status(),
                row.relatedShiftId(),
                row.lastNotifiedAt(),
                row.notificationCount(),
                createdBy,
                row.createdAt(),
                row.updatedAt()
        );
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
        jdbcTemplate.execute(
                """
                CREATE TABLE IF NOT EXISTS employee_performance_reviews (
                  review_id VARCHAR(64) PRIMARY KEY,
                  employee_user_id VARCHAR(64) NOT NULL,
                  employee_email VARCHAR(255) NOT NULL,
                  employee_name VARCHAR(255) NOT NULL,
                  review_type VARCHAR(32) NOT NULL,
                  category VARCHAR(64) NOT NULL,
                  title VARCHAR(160) NOT NULL,
                  summary TEXT NOT NULL,
                  review_status VARCHAR(32) NOT NULL DEFAULT 'OPEN',
                  related_shift_id VARCHAR(64) NULL,
                  source_key VARCHAR(160) NULL,
                  last_notified_at BIGINT NULL,
                  notification_count INT NOT NULL DEFAULT 0,
                  created_by_user_id VARCHAR(64) NULL,
                  created_by_email VARCHAR(255) NULL,
                  created_at BIGINT NOT NULL,
                  updated_at BIGINT NOT NULL
                )
                """
        );
    }

    private EmployeeIdentity resolveAdminActor(User user) {
        EmployeeIdentity identity = resolveEmployee(user);
        if (!"admin".equals(identity.role())) {
            throw new IllegalStateException("Forbidden. Admin access required.");
        }
        return identity;
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

        String displayName = ((user.getFirstName() == null ? "" : user.getFirstName()) + " "
                + (user.getLastName() == null ? "" : user.getLastName())).trim();
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

    private EmployeeIdentity resolveTargetEmployee(String employeeUserId, String employeeEmail, String employeeName) {
        String normalizedUserId = sanitizeOptionalText(employeeUserId, 64);
        String normalizedEmail = sanitizeOptionalText(employeeEmail, 255);
        String normalizedName = sanitizeOptionalText(employeeName, 255);

        if (normalizedUserId == null && normalizedEmail == null) {
            throw new IllegalStateException("Employee user id or email is required.");
        }

        List<EmployeeIdentity> matches = jdbcTemplate.query(
                """
                SELECT employee_user_id, employee_email, employee_name, employee_role
                  FROM attendance_shifts
                 WHERE (? IS NOT NULL AND employee_user_id = ?)
                    OR (? IS NOT NULL AND LOWER(employee_email) = LOWER(?))
                 ORDER BY clock_in_at DESC
                 LIMIT 1
                """,
                (rs, rowNum) -> new EmployeeIdentity(
                        rs.getString("employee_email"),
                        rs.getString("employee_name"),
                        rs.getString("employee_role"),
                        rs.getString("employee_user_id")
                ),
                normalizedUserId,
                normalizedUserId,
                normalizedEmail,
                normalizedEmail
        );

        if (!matches.isEmpty()) {
            EmployeeIdentity match = matches.getFirst();
            return new EmployeeIdentity(
                    match.email(),
                    StringUtils.hasText(normalizedName) ? normalizedName : match.displayName(),
                    match.role(),
                    match.userId()
            );
        }

        return new EmployeeIdentity(
                normalizedEmail == null ? normalizedUserId : normalizedEmail,
                StringUtils.hasText(normalizedName) ? normalizedName : (normalizedEmail == null ? normalizedUserId : normalizedEmail),
                "employee",
                normalizedUserId == null ? normalizedEmail : normalizedUserId
        );
    }

    private void sendPerformanceEmail(
            EmployeeIdentity employee,
            String title,
            String summary,
            String category,
            String reviewType
    ) {
        if (!StringUtils.hasText(employee.email())) {
            return;
        }
        String subject = "Attendance notice: " + title;
        String content = emailTemplateService.generateAttendancePolicyAlertEmail(
                employee.displayName(),
                title,
                summary,
                category,
                reviewType
        );
        emailService.sendEmail(employee.email(), subject, content);
    }

    private String sanitizeNote(String note) {
        return sanitizeOptionalText(note, 400);
    }

    private String sanitizeDateInput(String value) {
        if (!StringUtils.hasText(value)) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.matches("\\d{4}-\\d{2}-\\d{2}") ? trimmed : null;
    }

    private String sanitizeQuery(String value, int maxLength) {
        if (!StringUtils.hasText(value)) {
            return "";
        }
        String trimmed = value.trim();
        return trimmed.length() > maxLength ? trimmed.substring(0, maxLength) : trimmed;
    }

    private String sanitizeRequiredText(String value, int maxLength, String errorMessage) {
        String normalized = sanitizeOptionalText(value, maxLength);
        if (!StringUtils.hasText(normalized)) {
            throw new IllegalStateException(errorMessage);
        }
        return normalized;
    }

    private String sanitizeOptionalText(String value, int maxLength) {
        if (!StringUtils.hasText(value)) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.length() > maxLength ? trimmed.substring(0, maxLength) : trimmed;
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

    private String normalizeAttendanceStatus(String value) {
        String normalized = StringUtils.hasText(value) ? value.trim().toLowerCase(Locale.ROOT) : "all";
        return switch (normalized) {
            case "active", "on_break", "closed", "all" -> normalized;
            default -> "all";
        };
    }

    private String normalizeReviewStatusFilter(String value) {
        if (!StringUtils.hasText(value)) {
            return "all";
        }
        String normalized = value.trim().toUpperCase(Locale.ROOT);
        if (REVIEW_STATUS_OPEN.equals(normalized)
                || REVIEW_STATUS_ACKNOWLEDGED.equals(normalized)
                || REVIEW_STATUS_RESOLVED.equals(normalized)) {
            return normalized;
        }
        return "all";
    }

    private String normalizeReviewStatus(String value) {
        String normalized = StringUtils.hasText(value) ? value.trim().toUpperCase(Locale.ROOT) : REVIEW_STATUS_OPEN;
        return switch (normalized) {
            case REVIEW_STATUS_OPEN, REVIEW_STATUS_ACKNOWLEDGED, REVIEW_STATUS_RESOLVED -> normalized;
            default -> throw new IllegalStateException("Invalid review status.");
        };
    }

    private String normalizeReviewType(String value) {
        String normalized = StringUtils.hasText(value) ? value.trim().toUpperCase(Locale.ROOT) : REVIEW_TYPE_NEGATIVE;
        return switch (normalized) {
            case REVIEW_TYPE_WARNING, REVIEW_TYPE_REPRIMAND, REVIEW_TYPE_NEGATIVE -> normalized;
            default -> throw new IllegalStateException("Invalid review type.");
        };
    }

    private String normalizeCategory(String value, String fallback) {
        String normalized = StringUtils.hasText(value) ? value.trim().toUpperCase(Locale.ROOT) : fallback;
        return switch (normalized) {
            case CATEGORY_ATTENDANCE, CATEGORY_LONG_BREAK, CATEGORY_LOW_HOURS, CATEGORY_MANUAL -> normalized;
            default -> fallback;
        };
    }

    private String normalizeLookupKey(String employeeUserId, String employeeEmail) {
        if (StringUtils.hasText(employeeUserId)) {
            return employeeUserId.trim();
        }
        return employeeEmail == null ? "" : employeeEmail.trim().toLowerCase(Locale.ROOT);
    }

    private List<Object> mergeArgs(List<Object> first, List<Object> second) {
        List<Object> merged = new ArrayList<>(first.size() + second.size());
        merged.addAll(first);
        merged.addAll(second);
        return merged;
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

    private RowMapper<PerformanceReviewRow> performanceReviewRowMapper() {
        return (rs, rowNum) -> new PerformanceReviewRow(
                rs.getString("review_id"),
                rs.getString("employee_user_id"),
                rs.getString("employee_email"),
                rs.getString("employee_name"),
                rs.getString("review_type"),
                rs.getString("category"),
                rs.getString("title"),
                rs.getString("summary"),
                rs.getString("review_status"),
                rs.getString("related_shift_id"),
                rs.getString("source_key"),
                getNullableLong(rs, "last_notified_at"),
                rs.getInt("notification_count"),
                rs.getString("created_by_user_id"),
                rs.getString("created_by_email"),
                rs.getLong("created_at"),
                rs.getLong("updated_at")
        );
    }

    private RowMapper<OpenBreakMonitorRow> openBreakMonitorRowMapper() {
        return (rs, rowNum) -> new OpenBreakMonitorRow(
                attendanceShiftRowMapper().mapRow(rs, rowNum),
                rs.getLong("active_break_started_at")
        );
    }

    private RowMapper<DailyWorkMonitorRow> dailyWorkMonitorRowMapper() {
        return (rs, rowNum) -> new DailyWorkMonitorRow(
                rs.getString("employee_user_id"),
                rs.getString("employee_email"),
                rs.getString("employee_name"),
                rs.getString("employee_role"),
                rs.getString("shift_date"),
                rs.getLong("worked_minutes")
        );
    }

    private Long getNullableLong(ResultSet rs, String column) throws SQLException {
        long value = rs.getLong(column);
        return rs.wasNull() ? null : value;
    }
}
