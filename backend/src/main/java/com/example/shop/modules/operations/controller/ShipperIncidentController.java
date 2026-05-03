package com.example.shop.modules.operations.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.util.StringUtils;
import org.springframework.web.bind.annotation.*;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

@RestController
@RequestMapping("/api/v1/shipper/incidents")
@RequiredArgsConstructor
public class ShipperIncidentController {

    private final JdbcTemplate jdbcTemplate;

    private static final Set<String> ALLOWED_TYPES = Set.of(
            "DELIVERY_DELAY", "QUALITY_COMPLAINT", "DAMAGED_PACKAGE", "FAILED_ATTEMPT", "OTHER"
    );
    private static final Set<String> ALLOWED_SEVERITIES = Set.of("LOW", "MEDIUM", "HIGH");

    @GetMapping
    @PreAuthorize("hasAnyRole('ADMIN', 'EMPLOYEE', 'SHIPPER')")
    public ResponseEntity<List<Map<String, Object>>> listIncidents(
            @RequestParam(name = "status", required = false) String status
    ) {
        String normalizedStatus = normalizeNullableUpper(status);
        String sql = """
                SELECT i.id, i.order_id, o.order_number, o.customer_email, i.incident_type, i.severity, i.status,
                       i.details, i.created_by, i.resolved_by, i.created_at, i.resolved_at, i.updated_at
                FROM shipper_incidents i
                JOIN orders o ON o.id = i.order_id
                """ + (StringUtils.hasText(normalizedStatus) ? " WHERE i.status = ? " : "") + """
                ORDER BY i.created_at DESC
                LIMIT 300
                """;

        List<Map<String, Object>> rows = StringUtils.hasText(normalizedStatus)
                ? jdbcTemplate.queryForList(sql, normalizedStatus)
                : jdbcTemplate.queryForList(sql);
        return ResponseEntity.ok(rows);
    }

    @PostMapping
    @PreAuthorize("hasAnyRole('ADMIN', 'EMPLOYEE', 'SHIPPER')")
    public ResponseEntity<Map<String, Object>> createIncident(@RequestBody Map<String, Object> body) {
        long orderId = toLong(body.get("orderId"));
        if (orderId <= 0) {
            return ResponseEntity.badRequest().body(Map.of("error", "Valid orderId is required"));
        }

        String type = normalizeUpper(String.valueOf(body.getOrDefault("incidentType", "")));
        if (!ALLOWED_TYPES.contains(type)) {
            return ResponseEntity.badRequest().body(Map.of("error", "Invalid incidentType"));
        }

        String severity = normalizeUpper(String.valueOf(body.getOrDefault("severity", "MEDIUM")));
        if (!ALLOWED_SEVERITIES.contains(severity)) {
            return ResponseEntity.badRequest().body(Map.of("error", "Invalid severity"));
        }

        String details = trimToNull(String.valueOf(body.getOrDefault("details", "")));
        if (!StringUtils.hasText(details)) {
            return ResponseEntity.badRequest().body(Map.of("error", "details is required"));
        }
        if (details.length() > 1200) {
            details = details.substring(0, 1200);
        }

        int exists = jdbcTemplate.queryForObject(
                "SELECT COUNT(1) FROM orders WHERE id = ?",
                Integer.class,
                orderId
        );
        if (exists <= 0) {
            return ResponseEntity.status(404).body(Map.of("error", "Order not found"));
        }

        String actor = currentActor();
        Long incidentId = jdbcTemplate.queryForObject(
                """
                INSERT INTO shipper_incidents (order_id, incident_type, severity, status, details, created_by, updated_at)
                VALUES (?, ?, ?, 'OPEN', ?, ?, CURRENT_TIMESTAMP)
                RETURNING id
                """,
                Long.class,
                orderId, type, severity, details, actor
        );

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("message", "Incident created");
        response.put("id", incidentId);
        return ResponseEntity.ok(response);
    }

    @PatchMapping("/{id}/resolve")
    @PreAuthorize("hasAnyRole('ADMIN', 'EMPLOYEE')")
    public ResponseEntity<Map<String, Object>> resolveIncident(@PathVariable("id") long id) {
        String actor = currentActor();
        int updated = jdbcTemplate.update(
                """
                UPDATE shipper_incidents
                SET status = 'RESOLVED', resolved_by = ?, resolved_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
                WHERE id = ? AND status <> 'RESOLVED'
                """,
                actor,
                id
        );
        if (updated == 0) {
            return ResponseEntity.status(404).body(Map.of("error", "Incident not found or already resolved"));
        }
        return ResponseEntity.ok(Map.of("message", "Incident resolved", "id", id));
    }

    private static long toLong(Object value) {
        if (value instanceof Number n) return n.longValue();
        try {
            return Long.parseLong(String.valueOf(value));
        } catch (Exception ignored) {
            return -1;
        }
    }

    private static String trimToNull(String value) {
        String trimmed = value == null ? "" : value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    private static String normalizeUpper(String value) {
        return value == null ? "" : value.trim().toUpperCase(Locale.ROOT);
    }

    private static String normalizeNullableUpper(String value) {
        String normalized = normalizeUpper(value);
        return normalized.isEmpty() ? null : normalized;
    }

    private static String currentActor() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        return auth != null && StringUtils.hasText(auth.getName()) ? auth.getName() : "unknown";
    }
}
