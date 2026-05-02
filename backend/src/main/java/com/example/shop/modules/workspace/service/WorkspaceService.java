package com.example.shop.modules.workspace.service;

import lombok.RequiredArgsConstructor;
import org.springframework.dao.EmptyResultDataAccessException;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.nio.charset.StandardCharsets;
import java.sql.ResultSet;
import java.sql.Timestamp;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;

@Service
@RequiredArgsConstructor
public class WorkspaceService {

    private final JdbcTemplate jdbcTemplate;
    private static final DateTimeFormatter TS_FORMAT = DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH:mm:ss");

    @Transactional
    public Map<String, Object> createTask(Map<String, Object> body, String actor) {
        String title = text(body.get("title"));
        if (!StringUtils.hasText(title)) {
            throw new IllegalArgumentException("title is required");
        }

        String taskKey = "TASK-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase(Locale.ROOT);
        String status = optionalText(body.get("status"), "OPEN").toUpperCase(Locale.ROOT);
        String priority = optionalText(body.get("priority"), "MEDIUM").toUpperCase(Locale.ROOT);
        String assignedTo = normalizeNullable(body.get("assigned_to"));
        String description = normalizeNullable(body.get("description"));
        Timestamp dueAt = parseTimestamp(body.get("due_at"));

        Long id = jdbcTemplate.queryForObject("""
                INSERT INTO workflow_tasks (task_key, title, description, status, priority, assigned_to, created_by, due_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                RETURNING id
                """, Long.class, taskKey, title, description, status, priority, assignedTo, actor, dueAt);

        insertTaskEvent(id, "CREATED", actor, "Task created");
        insertAudit("WORKFLOW_TASK_CREATED", "workflow_tasks", taskKey, actor,
                Map.of("title", title, "assigned_to", assignedTo == null ? "" : assignedTo, "priority", priority));

        if (assignedTo != null) {
            createNotification(assignedTo, "New task assigned", "You have been assigned " + taskKey, "WORKFLOW_TASK", taskKey);
        }

        return getTaskById(id);
    }

    @Transactional
    public Map<String, Object> updateTaskStatus(Long id, String status, String actor, String notes) {
        int updated = jdbcTemplate.update("""
                UPDATE workflow_tasks
                SET status = ?,
                    completed_at = CASE WHEN ? = 'DONE' THEN CURRENT_TIMESTAMP ELSE NULL END,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
                """, status.toUpperCase(Locale.ROOT), status.toUpperCase(Locale.ROOT), id);
        if (updated == 0) throw new IllegalArgumentException("Task not found");

        Map<String, Object> task = getTaskById(id);
        insertTaskEvent(id, "STATUS_CHANGED", actor, notes == null ? "Status changed to " + status : notes);
        insertAudit("WORKFLOW_TASK_STATUS_CHANGED", "workflow_tasks", String.valueOf(task.get("task_key")), actor,
                Map.of("status", status.toUpperCase(Locale.ROOT)));

        String assignedTo = (String) task.get("assigned_to");
        if (assignedTo != null) {
            createNotification(assignedTo, "Task status updated",
                    task.get("task_key") + " is now " + status.toUpperCase(Locale.ROOT), "WORKFLOW_TASK", String.valueOf(task.get("task_key")));
        }
        return task;
    }

    @Transactional
    public Map<String, Object> assignTask(Long id, String assignee, String actor) {
        int updated = jdbcTemplate.update("""
                UPDATE workflow_tasks
                SET assigned_to = ?, updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
                """, assignee, id);
        if (updated == 0) throw new IllegalArgumentException("Task not found");

        Map<String, Object> task = getTaskById(id);
        insertTaskEvent(id, "ASSIGNED", actor, "Assigned to " + assignee);
        insertAudit("WORKFLOW_TASK_ASSIGNED", "workflow_tasks", String.valueOf(task.get("task_key")), actor,
                Map.of("assigned_to", assignee));
        createNotification(assignee, "Task assigned", "You were assigned " + task.get("task_key"), "WORKFLOW_TASK", String.valueOf(task.get("task_key")));
        return task;
    }

    @Transactional
    public Map<String, Object> escalateTask(Long id, String actor, String reason) {
        int updated = jdbcTemplate.update("""
                UPDATE workflow_tasks
                SET status = 'ESCALATED', escalated_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
                """, id);
        if (updated == 0) throw new IllegalArgumentException("Task not found");

        Map<String, Object> task = getTaskById(id);
        insertTaskEvent(id, "ESCALATED", actor, reason);
        insertAudit("WORKFLOW_TASK_ESCALATED", "workflow_tasks", String.valueOf(task.get("task_key")), actor,
                Map.of("reason", reason == null ? "" : reason));

        createNotification(actor, "Task escalated", task.get("task_key") + " has been escalated", "WORKFLOW_TASK", String.valueOf(task.get("task_key")));
        return task;
    }

    public List<Map<String, Object>> listTasks(String assignedTo, String status, int limit) {
        int safeLimit = Math.max(1, Math.min(100, limit));
        StringBuilder sql = new StringBuilder("SELECT * FROM workflow_tasks WHERE 1=1");
        List<Object> params = new ArrayList<>();

        if (StringUtils.hasText(assignedTo)) {
            sql.append(" AND assigned_to = ?");
            params.add(assignedTo.trim());
        }
        if (StringUtils.hasText(status)) {
            sql.append(" AND status = ?");
            params.add(status.trim().toUpperCase(Locale.ROOT));
        }

        sql.append(" ORDER BY created_at DESC LIMIT ?");
        params.add(safeLimit);

        return jdbcTemplate.query(sql.toString(), this::mapTask, params.toArray());
    }

    public List<Map<String, Object>> listNotifications(String recipient, Boolean unreadOnly, int limit) {
        int safeLimit = Math.max(1, Math.min(200, limit));
        StringBuilder sql = new StringBuilder("SELECT * FROM app_notifications WHERE recipient = ?");
        List<Object> params = new ArrayList<>(List.of(recipient));
        if (Boolean.TRUE.equals(unreadOnly)) {
            sql.append(" AND is_read = FALSE");
        }
        sql.append(" ORDER BY created_at DESC LIMIT ?");
        params.add(safeLimit);

        return jdbcTemplate.query(sql.toString(), (rs, rowNum) -> {
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("id", rs.getLong("id"));
            row.put("title", rs.getString("title"));
            row.put("message", rs.getString("message"));
            row.put("channel", rs.getString("channel"));
            row.put("source_type", rs.getString("source_type"));
            row.put("source_id", rs.getString("source_id"));
            row.put("is_read", rs.getBoolean("is_read"));
            row.put("read_at", fmt(rs.getTimestamp("read_at")));
            row.put("created_at", fmt(rs.getTimestamp("created_at")));
            return row;
        }, params.toArray());
    }

    @Transactional
    public void markNotificationRead(Long id, String recipient) {
        int updated = jdbcTemplate.update("""
                UPDATE app_notifications
                SET is_read = TRUE, read_at = CURRENT_TIMESTAMP
                WHERE id = ? AND recipient = ?
                """, id, recipient);
        if (updated == 0) throw new IllegalArgumentException("Notification not found");
    }

    public List<Map<String, Object>> listAuditEvents(int limit) {
        int safeLimit = Math.max(1, Math.min(200, limit));
        return jdbcTemplate.query("""
                SELECT id, event_type, entity_type, entity_id, actor, details::text AS details, created_at
                FROM audit_events ORDER BY created_at DESC LIMIT ?
                """, (rs, rowNum) -> {
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("id", rs.getLong("id"));
            row.put("event_type", rs.getString("event_type"));
            row.put("entity_type", rs.getString("entity_type"));
            row.put("entity_id", rs.getString("entity_id"));
            row.put("actor", rs.getString("actor"));
            row.put("details", rs.getString("details"));
            row.put("created_at", fmt(rs.getTimestamp("created_at")));
            return row;
        }, safeLimit);
    }

    public ResponseEntity<byte[]> exportReport(String type, String principal) {
        String normalized = optionalText(type, "workflow").toLowerCase(Locale.ROOT);
        String csv;
        switch (normalized) {
            case "notifications" -> csv = exportNotificationsCsv(principal);
            case "audit" -> csv = exportAuditCsv();
            default -> csv = exportWorkflowCsv();
        }

        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=" + normalized + "-report.csv")
                .contentType(new MediaType("text", "csv", StandardCharsets.UTF_8))
                .body(csv.getBytes(StandardCharsets.UTF_8));
    }

    private String exportWorkflowCsv() {
        List<Map<String, Object>> rows = listTasks(null, null, 500);
        StringBuilder sb = new StringBuilder("id,task_key,title,status,priority,assigned_to,created_by,due_at,created_at\n");
        for (Map<String, Object> row : rows) {
            sb.append(csv(row.get("id"))).append(',')
                    .append(csv(row.get("task_key"))).append(',')
                    .append(csv(row.get("title"))).append(',')
                    .append(csv(row.get("status"))).append(',')
                    .append(csv(row.get("priority"))).append(',')
                    .append(csv(row.get("assigned_to"))).append(',')
                    .append(csv(row.get("created_by"))).append(',')
                    .append(csv(row.get("due_at"))).append(',')
                    .append(csv(row.get("created_at"))).append('\n');
        }
        return sb.toString();
    }

    private String exportNotificationsCsv(String principal) {
        List<Map<String, Object>> rows = listNotifications(principal, false, 500);
        StringBuilder sb = new StringBuilder("id,title,message,channel,source_type,source_id,is_read,created_at\n");
        for (Map<String, Object> row : rows) {
            sb.append(csv(row.get("id"))).append(',')
                    .append(csv(row.get("title"))).append(',')
                    .append(csv(row.get("message"))).append(',')
                    .append(csv(row.get("channel"))).append(',')
                    .append(csv(row.get("source_type"))).append(',')
                    .append(csv(row.get("source_id"))).append(',')
                    .append(csv(row.get("is_read"))).append(',')
                    .append(csv(row.get("created_at"))).append('\n');
        }
        return sb.toString();
    }

    private String exportAuditCsv() {
        List<Map<String, Object>> rows = listAuditEvents(500);
        StringBuilder sb = new StringBuilder("id,event_type,entity_type,entity_id,actor,details,created_at\n");
        for (Map<String, Object> row : rows) {
            sb.append(csv(row.get("id"))).append(',')
                    .append(csv(row.get("event_type"))).append(',')
                    .append(csv(row.get("entity_type"))).append(',')
                    .append(csv(row.get("entity_id"))).append(',')
                    .append(csv(row.get("actor"))).append(',')
                    .append(csv(row.get("details"))).append(',')
                    .append(csv(row.get("created_at"))).append('\n');
        }
        return sb.toString();
    }

    private void insertTaskEvent(Long taskId, String eventType, String actor, String notes) {
        jdbcTemplate.update("INSERT INTO workflow_task_events (task_id, event_type, actor, notes) VALUES (?, ?, ?, ?)",
                taskId, eventType, actor, normalizeNullable(notes));
    }

    private void insertAudit(String eventType, String entityType, String entityId, String actor, Map<String, Object> details) {
        jdbcTemplate.update("""
                INSERT INTO audit_events (event_type, entity_type, entity_id, actor, details)
                VALUES (?, ?, ?, ?, CAST(? AS jsonb))
                """, eventType, entityType, entityId, actor, toJson(details));
    }

    private void createNotification(String recipient, String title, String message, String sourceType, String sourceId) {
        jdbcTemplate.update("""
                INSERT INTO app_notifications (recipient, title, message, channel, source_type, source_id)
                VALUES (?, ?, ?, 'IN_APP', ?, ?)
                """, recipient, title, message, sourceType, sourceId);
    }

    private Map<String, Object> getTaskById(Long id) {
        try {
            return jdbcTemplate.queryForObject("SELECT * FROM workflow_tasks WHERE id = ?", this::mapTask, id);
        } catch (EmptyResultDataAccessException ex) {
            throw new IllegalArgumentException("Task not found");
        }
    }

    private Map<String, Object> mapTask(ResultSet rs, int rowNum) throws java.sql.SQLException {
        Map<String, Object> row = new LinkedHashMap<>();
        row.put("id", rs.getLong("id"));
        row.put("task_key", rs.getString("task_key"));
        row.put("title", rs.getString("title"));
        row.put("description", rs.getString("description"));
        row.put("status", rs.getString("status"));
        row.put("priority", rs.getString("priority"));
        row.put("assigned_to", rs.getString("assigned_to"));
        row.put("created_by", rs.getString("created_by"));
        row.put("due_at", fmt(rs.getTimestamp("due_at")));
        row.put("completed_at", fmt(rs.getTimestamp("completed_at")));
        row.put("escalated_at", fmt(rs.getTimestamp("escalated_at")));
        row.put("created_at", fmt(rs.getTimestamp("created_at")));
        row.put("updated_at", fmt(rs.getTimestamp("updated_at")));
        return row;
    }

    private String fmt(Timestamp ts) {
        if (ts == null) return null;
        return ts.toLocalDateTime().format(TS_FORMAT);
    }

    private String csv(Object value) {
        if (value == null) return "";
        String raw = value.toString().replace("\"", "\"\"");
        return '"' + raw + '"';
    }

    private String text(Object value) {
        return value == null ? "" : value.toString().trim();
    }

    private String optionalText(Object value, String fallback) {
        String s = text(value);
        return s.isEmpty() ? fallback : s;
    }

    private String normalizeNullable(Object value) {
        String s = text(value);
        return s.isEmpty() ? null : s;
    }

    private Timestamp parseTimestamp(Object value) {
        if (value == null) return null;
        String raw = value.toString().trim();
        if (raw.isEmpty()) return null;
        return Timestamp.valueOf(LocalDateTime.parse(raw));
    }

    private String toJson(Map<String, Object> details) {
        StringJoiner joiner = new StringJoiner(",", "{", "}");
        for (Map.Entry<String, Object> entry : details.entrySet()) {
            String key = entry.getKey().replace("\"", "\\\"");
            String value = String.valueOf(entry.getValue()).replace("\"", "\\\"");
            joiner.add("\"" + key + "\":\"" + value + "\"");
        }
        return joiner.toString();
    }
}
