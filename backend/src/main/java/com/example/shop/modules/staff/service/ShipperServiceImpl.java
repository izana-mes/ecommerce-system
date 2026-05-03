package com.example.shop.modules.staff.service;

import com.example.shop.common.exception.BusinessException;
import com.example.shop.modules.staff.dto.ShipperDto;
import com.example.shop.modules.staff.dto.ShipperLocationDto;
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
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class ShipperServiceImpl implements ShipperService {

    private final JdbcTemplate jdbcTemplate;
    private final SimpMessagingTemplate messagingTemplate;

    @Override
    @Transactional(readOnly = true)
    public List<ShipperDto> listShippers() {
        return jdbcTemplate.query("""
                SELECT u.users_id::text AS id,
                       u.email,
                       u.first_name,
                       u.last_name,
                       COUNT(o.id) FILTER (
                           WHERE o.order_status NOT IN ('completed', 'cancelled', 'delivered')
                       ) AS active_order_count
                FROM users u
                INNER JOIN user_roles ur ON ur.users_id = u.users_id
                INNER JOIN roles r ON r.roles_id = ur.roles_id AND r.roles_name = 'ROLE_SHIPPER'
                LEFT JOIN orders o ON o.shipper_user_id = u.users_id
                WHERE u.is_active = true
                GROUP BY u.users_id, u.email, u.first_name, u.last_name
                ORDER BY u.first_name, u.last_name
                """,
                (rs, rowNum) -> new ShipperDto(
                        rs.getString("id"),
                        rs.getString("email"),
                        rs.getString("first_name"),
                        rs.getString("last_name"),
                        rs.getLong("active_order_count")
                )
        );
    }

    @Override
    @Transactional
    public void assignShipper(Long orderId, UUID shipperUserId, String expectedDeliveryAt, String changedBy) {
        List<Map<String, Object>> rows = jdbcTemplate.queryForList(
                "SELECT id, order_number, order_status, shipper_user_id FROM orders WHERE id = ?", orderId
        );
        if (rows.isEmpty()) {
            throw new BusinessException("Order not found: " + orderId, HttpStatus.NOT_FOUND);
        }

        Map<String, Object> order = rows.get(0);
        String orderNumber = (String) order.get("order_number");
        String prevStatus = (String) order.get("order_status");

        // Validate shipper exists and has ROLE_SHIPPER
        Long shipperCount = jdbcTemplate.queryForObject(
                """
                SELECT COUNT(*) FROM users u
                INNER JOIN user_roles ur ON ur.users_id = u.users_id
                INNER JOIN roles r ON r.roles_id = ur.roles_id AND r.roles_name = 'ROLE_SHIPPER'
                WHERE u.users_id = ? AND u.is_active = true
                """,
                Long.class, shipperUserId
        );
        if (shipperCount == null || shipperCount == 0) {
            throw new BusinessException("Active shipper not found: " + shipperUserId, HttpStatus.NOT_FOUND);
        }

        LocalDateTime now = LocalDateTime.now();
        LocalDateTime expectedDelivery = null;
        if (StringUtils.hasText(expectedDeliveryAt)) {
            try {
                expectedDelivery = LocalDateTime.parse(expectedDeliveryAt);
            } catch (Exception ex) {
                log.warn("Could not parse expectedDeliveryAt '{}': {}", expectedDeliveryAt, ex.getMessage());
            }
        }

        if (expectedDelivery != null) {
            jdbcTemplate.update(
                    "UPDATE orders SET shipper_user_id = ?, expected_delivery_at = ?, updated_at = ? WHERE id = ?",
                    shipperUserId, Timestamp.valueOf(expectedDelivery), Timestamp.valueOf(now), orderId
            );
        } else {
            jdbcTemplate.update(
                    "UPDATE orders SET shipper_user_id = ?, updated_at = ? WHERE id = ?",
                    shipperUserId, Timestamp.valueOf(now), orderId
            );
        }

        jdbcTemplate.update(
                "INSERT INTO order_status_logs (order_id, previous_status, new_status, note, changed_by, created_at) VALUES (?, ?, ?, ?, ?, ?)",
                orderId, prevStatus, prevStatus, "Shipper assigned: " + shipperUserId, changedBy, Timestamp.valueOf(now)
        );

        // Broadcast via WebSocket
        try {
            Map<String, Object> event = new java.util.LinkedHashMap<>();
            event.put("orderId", orderId);
            event.put("orderNumber", orderNumber);
            event.put("shipperUserId", shipperUserId.toString());
            event.put("changedBy", changedBy);
            messagingTemplate.convertAndSend("/topic/staff/orders", event);
        } catch (Exception ex) {
            log.warn("Failed to broadcast shipper assignment for order {}: {}", orderId, ex.getMessage());
        }
    }

    @Override
    @Transactional(readOnly = true)
    public Optional<ShipperLocationDto> getShipperCurrentLocation(UUID shipperUserId) {
        List<ShipperLocationDto> rows = jdbcTemplate.query(
                """
                SELECT shipper_user_id::text, order_id, latitude, longitude, speed, heading, accuracy_meters, recorded_at
                FROM shipper_location_history
                WHERE shipper_user_id = ?
                ORDER BY recorded_at DESC
                LIMIT 1
                """,
                (rs, rowNum) -> new ShipperLocationDto(
                        rs.getString("shipper_user_id"),
                        rs.getObject("order_id") == null ? null : rs.getLong("order_id"),
                        rs.getBigDecimal("latitude"),
                        rs.getBigDecimal("longitude"),
                        rs.getBigDecimal("speed"),
                        rs.getBigDecimal("heading"),
                        rs.getBigDecimal("accuracy_meters"),
                        rs.getTimestamp("recorded_at") == null ? null : rs.getTimestamp("recorded_at").toLocalDateTime()
                ),
                shipperUserId
        );
        return rows.isEmpty() ? Optional.empty() : Optional.of(rows.get(0));
    }
}
