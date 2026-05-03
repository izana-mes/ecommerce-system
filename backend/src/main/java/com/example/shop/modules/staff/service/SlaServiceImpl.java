package com.example.shop.modules.staff.service;

import com.example.shop.modules.staff.dto.SlaOrderDto;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.sql.Timestamp;
import java.time.LocalDateTime;
import java.util.Collections;
import java.util.List;

@Service
@RequiredArgsConstructor
@Slf4j
public class SlaServiceImpl implements SlaService {

    private final JdbcTemplate jdbcTemplate;

    private static final String TERMINAL_STATUS_CLAUSE =
            "order_status NOT IN ('completed', 'cancelled', 'delivered', 'failed')";

    @Override
    @Transactional(readOnly = true)
    public List<SlaOrderDto> getLateOrders() {
        LocalDateTime now = LocalDateTime.now();
        try {
            return jdbcTemplate.query(
                    buildSlaQuery("o.expected_delivery_at < ?"),
                    (rs, rowNum) -> mapSlaRow(rs, now),
                    Timestamp.valueOf(now)
            );
        } catch (DataAccessException ex) {
            log.warn("Late SLA query failed: {}", ex.getMessage());
            return Collections.emptyList();
        }
    }

    @Override
    @Transactional(readOnly = true)
    public List<SlaOrderDto> getNearLateOrders(int thresholdMinutes) {
        int safeMinutes = Math.max(1, Math.min(thresholdMinutes, 1440));
        LocalDateTime now = LocalDateTime.now();
        LocalDateTime threshold = now.plusMinutes(safeMinutes);
        try {
            return jdbcTemplate.query(
                    buildSlaQuery("o.expected_delivery_at >= ? AND o.expected_delivery_at <= ?"),
                    (rs, rowNum) -> mapSlaRow(rs, now),
                    Timestamp.valueOf(now),
                    Timestamp.valueOf(threshold)
            );
        } catch (DataAccessException ex) {
            log.warn("Near-late SLA query failed: {}", ex.getMessage());
            return Collections.emptyList();
        }
    }

    private String buildSlaQuery(String deadlineCondition) {
        return """
               SELECT o.id,
                      o.order_number,
                      o.customer_email,
                      o.customer_first_name,
                      o.customer_last_name,
                      o.order_status,
                      o.payment_status,
                      o.shipper_user_id::text AS shipper_user_id,
                      u.email AS shipper_email,
                      o.total_amount,
                      o.currency,
                      o.expected_delivery_at,
                      o.created_at
               FROM orders o
               LEFT JOIN users u ON u.users_id = o.shipper_user_id
               WHERE o.expected_delivery_at IS NOT NULL
                 AND o.delivered_at IS NULL
                 AND """ + TERMINAL_STATUS_CLAUSE + """
               \n AND """ + deadlineCondition + """
               \n ORDER BY o.expected_delivery_at ASC
               """;
    }

    private SlaOrderDto mapSlaRow(java.sql.ResultSet rs, LocalDateTime now) throws java.sql.SQLException {
        LocalDateTime expectedDeliveryAt = rs.getTimestamp("expected_delivery_at") == null
                ? null : rs.getTimestamp("expected_delivery_at").toLocalDateTime();
        LocalDateTime createdAt = rs.getTimestamp("created_at") == null
                ? null : rs.getTimestamp("created_at").toLocalDateTime();

        long minutesLate = 0;
        String slaStatus = "ON_TIME";
        if (expectedDeliveryAt != null) {
            long minutesDiff = java.time.Duration.between(expectedDeliveryAt, now).toMinutes();
            minutesLate = minutesDiff;
            if (minutesDiff > 0) {
                slaStatus = "LATE";
            } else if (minutesDiff >= -30) {
                slaStatus = "NEAR_LATE";
            }
        }

        return new SlaOrderDto(
                rs.getLong("id"),
                rs.getString("order_number"),
                rs.getString("customer_email"),
                rs.getString("customer_first_name"),
                rs.getString("customer_last_name"),
                rs.getString("order_status"),
                rs.getString("payment_status"),
                rs.getString("shipper_user_id"),
                rs.getString("shipper_email"),
                rs.getBigDecimal("total_amount"),
                rs.getString("currency"),
                expectedDeliveryAt,
                createdAt,
                minutesLate,
                slaStatus
        );
    }
}
