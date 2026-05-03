package com.example.shop.modules.staff.service;

import com.example.shop.common.exception.BusinessException;
import com.example.shop.modules.staff.dto.IssueDto;
import com.example.shop.modules.staff.dto.RespondIssueRequest;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.sql.Timestamp;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
@Slf4j
public class IssueServiceImpl implements IssueService {

    private final JdbcTemplate jdbcTemplate;
    private final SimpMessagingTemplate messagingTemplate;

    @Override
    @Transactional(readOnly = true)
    public List<IssueDto> listIssues(String status) {
        // Build filter clause
        String logFilter = "";
        String helpFilter = "";
        List<Object> params = new ArrayList<>();

        if (StringUtils.hasText(status)) {
            logFilter = " AND UPPER(il.status) = UPPER(?)";
            helpFilter = " AND UPPER(hr.status) = UPPER(?)";
            params.add(status);
            params.add(status);
        }

        String sql = """
                SELECT 'LOG' AS source_table,
                       il.id,
                       il.order_id,
                       o.order_number,
                       il.shipper_user_id::text AS shipper_user_id,
                       u.email AS shipper_email,
                       il.issue_type,
                       il.message,
                       NULL AS priority,
                       il.status,
                       il.created_at,
                       il.updated_at
                FROM shipper_issue_logs il
                INNER JOIN orders o ON o.id = il.order_id
                INNER JOIN users u ON u.users_id = il.shipper_user_id
                WHERE 1=1
                """
                + logFilter
                + """

                UNION ALL

                SELECT 'HELP' AS source_table,
                       hr.id,
                       hr.order_id,
                       o.order_number,
                       hr.shipper_user_id::text AS shipper_user_id,
                       u.email AS shipper_email,
                       hr.message AS issue_type,
                       hr.message,
                       hr.priority,
                       hr.status,
                       hr.created_at,
                       hr.updated_at
                FROM shipper_help_requests hr
                INNER JOIN orders o ON o.id = hr.order_id
                INNER JOIN users u ON u.users_id = hr.shipper_user_id
                WHERE 1=1
                """
                + helpFilter
                + " ORDER BY created_at DESC";

        return jdbcTemplate.query(sql,
                (rs, rowNum) -> new IssueDto(
                        rs.getLong("id"),
                        rs.getString("source_table"),
                        rs.getLong("order_id"),
                        rs.getString("order_number"),
                        rs.getString("shipper_user_id"),
                        rs.getString("shipper_email"),
                        rs.getString("issue_type"),
                        rs.getString("message"),
                        rs.getString("priority"),
                        rs.getString("status"),
                        rs.getTimestamp("created_at") == null ? null : rs.getTimestamp("created_at").toLocalDateTime(),
                        rs.getTimestamp("updated_at") == null ? null : rs.getTimestamp("updated_at").toLocalDateTime()
                ),
                params.toArray()
        );
    }

    @Override
    @Transactional
    public IssueDto respondToIssueLog(Long id, RespondIssueRequest request, String responder) {
        List<Map<String, Object>> rows = jdbcTemplate.queryForList(
                "SELECT id, order_id, message, status FROM shipper_issue_logs WHERE id = ?", id
        );
        if (rows.isEmpty()) {
            throw new BusinessException("Issue log not found: " + id, HttpStatus.NOT_FOUND);
        }

        String currentMessage = (String) rows.get(0).get("message");
        String responseText = StringUtils.hasText(request.getResponse())
                ? "\n[Staff " + responder + "]: " + request.getResponse().trim()
                : "";
        String newMessage = (currentMessage == null ? "" : currentMessage) + responseText;
        String newStatus = request.isMarkResolved() ? "RESOLVED" : (String) rows.get(0).get("status");

        LocalDateTime now = LocalDateTime.now();
        jdbcTemplate.update(
                "UPDATE shipper_issue_logs SET message = ?, status = ?, updated_at = ? WHERE id = ?",
                newMessage, newStatus, Timestamp.valueOf(now), id
        );

        broadcastIssueUpdate(id, "LOG", newStatus);

        return fetchIssueLog(id);
    }

    @Override
    @Transactional
    public IssueDto respondToHelpRequest(Long id, RespondIssueRequest request, String responder) {
        List<Map<String, Object>> rows = jdbcTemplate.queryForList(
                "SELECT id, order_id, message, status FROM shipper_help_requests WHERE id = ?", id
        );
        if (rows.isEmpty()) {
            throw new BusinessException("Help request not found: " + id, HttpStatus.NOT_FOUND);
        }

        String currentMessage = (String) rows.get(0).get("message");
        String responseText = StringUtils.hasText(request.getResponse())
                ? "\n[Staff " + responder + "]: " + request.getResponse().trim()
                : "";
        String newMessage = (currentMessage == null ? "" : currentMessage) + responseText;
        String newStatus = request.isMarkResolved() ? "RESOLVED" : (String) rows.get(0).get("status");

        LocalDateTime now = LocalDateTime.now();
        jdbcTemplate.update(
                "UPDATE shipper_help_requests SET message = ?, status = ?, updated_at = ? WHERE id = ?",
                newMessage, newStatus, Timestamp.valueOf(now), id
        );

        broadcastIssueUpdate(id, "HELP", newStatus);

        return fetchHelpRequest(id);
    }

    private void broadcastIssueUpdate(Long id, String sourceTable, String status) {
        try {
            Map<String, Object> event = new java.util.LinkedHashMap<>();
            event.put("issueId", id);
            event.put("sourceTable", sourceTable);
            event.put("status", status);
            messagingTemplate.convertAndSend("/topic/staff/issues", event);
        } catch (Exception ex) {
            log.warn("Failed to broadcast issue update for {} {}: {}", sourceTable, id, ex.getMessage());
        }
    }

    private IssueDto fetchIssueLog(Long id) {
        List<IssueDto> rows = jdbcTemplate.query(
                """
                SELECT 'LOG' AS source_table, il.id, il.order_id, o.order_number,
                       il.shipper_user_id::text AS shipper_user_id, u.email AS shipper_email,
                       il.issue_type, il.message, NULL AS priority, il.status,
                       il.created_at, il.updated_at
                FROM shipper_issue_logs il
                INNER JOIN orders o ON o.id = il.order_id
                INNER JOIN users u ON u.users_id = il.shipper_user_id
                WHERE il.id = ?
                """,
                (rs, rowNum) -> mapIssueRow(rs),
                id
        );
        if (rows.isEmpty()) throw new BusinessException("Issue log not found: " + id, HttpStatus.NOT_FOUND);
        return rows.get(0);
    }

    private IssueDto fetchHelpRequest(Long id) {
        List<IssueDto> rows = jdbcTemplate.query(
                """
                SELECT 'HELP' AS source_table, hr.id, hr.order_id, o.order_number,
                       hr.shipper_user_id::text AS shipper_user_id, u.email AS shipper_email,
                       hr.message AS issue_type, hr.message, hr.priority, hr.status,
                       hr.created_at, hr.updated_at
                FROM shipper_help_requests hr
                INNER JOIN orders o ON o.id = hr.order_id
                INNER JOIN users u ON u.users_id = hr.shipper_user_id
                WHERE hr.id = ?
                """,
                (rs, rowNum) -> mapIssueRow(rs),
                id
        );
        if (rows.isEmpty()) throw new BusinessException("Help request not found: " + id, HttpStatus.NOT_FOUND);
        return rows.get(0);
    }

    private IssueDto mapIssueRow(java.sql.ResultSet rs) throws java.sql.SQLException {
        return new IssueDto(
                rs.getLong("id"),
                rs.getString("source_table"),
                rs.getLong("order_id"),
                rs.getString("order_number"),
                rs.getString("shipper_user_id"),
                rs.getString("shipper_email"),
                rs.getString("issue_type"),
                rs.getString("message"),
                rs.getString("priority"),
                rs.getString("status"),
                rs.getTimestamp("created_at") == null ? null : rs.getTimestamp("created_at").toLocalDateTime(),
                rs.getTimestamp("updated_at") == null ? null : rs.getTimestamp("updated_at").toLocalDateTime()
        );
    }
}
