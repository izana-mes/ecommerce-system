package com.example.shop.modules.admin.controller;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DataAccessException;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.util.StringUtils;
import org.springframework.web.bind.annotation.*;

import java.sql.Timestamp;
import java.time.format.DateTimeFormatter;
import java.util.*;

@RestController
@RequestMapping("/api/v1/admin")
@RequiredArgsConstructor
@Slf4j
public class AdminAuditController {

    private final JdbcTemplate jdbcTemplate;

    private static final DateTimeFormatter ISO_FORMATTER =
            DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH:mm:ss");

    /**
     * GET /api/v1/admin/audit-events
     * Returns paginated audit events, optionally filtered by eventType, entityType, dateFrom, dateTo.
     * All parameters are optional. Page is 0-indexed.
     */
    @GetMapping("/audit-events")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Map<String, Object>> getAuditEvents(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(required = false) String eventType,
            @RequestParam(required = false) String entityType,
            @RequestParam(required = false) String dateFrom,
            @RequestParam(required = false) String dateTo
    ) {
        int safePage = Math.max(0, page);
        int safeSize = Math.min(100, Math.max(1, size));

        List<String> whereParts = new ArrayList<>();
        List<Object> whereParams = new ArrayList<>();

        if (StringUtils.hasText(eventType)) {
            whereParts.add("event_type = ?");
            whereParams.add(eventType.trim());
        }
        if (StringUtils.hasText(entityType)) {
            whereParts.add("entity_type = ?");
            whereParams.add(entityType.trim());
        }
        if (StringUtils.hasText(dateFrom)) {
            whereParts.add("created_at::date >= ?::date");
            whereParams.add(dateFrom.trim());
        }
        if (StringUtils.hasText(dateTo)) {
            whereParts.add("created_at::date <= ?::date");
            whereParams.add(dateTo.trim());
        }

        String whereSql = whereParts.isEmpty() ? "" : "WHERE " + String.join(" AND ", whereParts);

        try {
            // Count total
            Long total = jdbcTemplate.queryForObject(
                    "SELECT COUNT(*) FROM audit_events " + whereSql,
                    Long.class,
                    whereParams.toArray()
            );
            long totalElements = total == null ? 0L : total;
            long totalPages = Math.max(1, (long) Math.ceil((double) totalElements / safeSize));

            // Fetch page
            List<Object> pageParams = new ArrayList<>(whereParams);
            pageParams.add(safeSize);
            pageParams.add((long) safePage * safeSize);

            List<Map<String, Object>> content = jdbcTemplate.query(
                    "SELECT id, event_type, entity_type, entity_id, actor, details, created_at " +
                    "FROM audit_events " + whereSql +
                    " ORDER BY created_at DESC LIMIT ? OFFSET ?",
                    (rs, rowNum) -> {
                        Map<String, Object> row = new LinkedHashMap<>();
                        row.put("id", rs.getLong("id"));
                        row.put("event_type", rs.getString("event_type"));
                        row.put("entity_type", rs.getString("entity_type"));
                        row.put("entity_id", rs.getString("entity_id"));
                        row.put("actor", rs.getString("actor"));
                        // details is stored as JSONB — parse to object if possible
                        String details = rs.getString("details");
                        row.put("details", details);
                        Timestamp ts = rs.getTimestamp("created_at");
                        row.put("created_at", ts == null ? null :
                                ts.toLocalDateTime().format(ISO_FORMATTER));
                        return row;
                    },
                    pageParams.toArray()
            );

            Map<String, Object> response = new LinkedHashMap<>();
            response.put("content", content);
            response.put("totalElements", totalElements);
            response.put("totalPages", totalPages);
            response.put("number", safePage);
            response.put("size", safeSize);
            return ResponseEntity.ok(response);

        } catch (DataAccessException ex) {
            log.error("Failed to query audit_events: {}", ex.getMessage());
            // Return empty page rather than 500 when table is missing or query fails
            Map<String, Object> empty = new LinkedHashMap<>();
            empty.put("content", List.of());
            empty.put("totalElements", 0L);
            empty.put("totalPages", 1L);
            empty.put("number", safePage);
            empty.put("size", safeSize);
            empty.put("unavailable", true);
            return ResponseEntity.ok(empty);
        }
    }
}
