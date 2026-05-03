package com.example.shop.modules.staff.service;

import com.example.shop.common.exception.BusinessException;
import com.example.shop.modules.staff.dto.StaffOrderDto;
import com.example.shop.modules.staff.dto.StaffOrderFilterRequest;
import com.example.shop.modules.staff.dto.StaffOrderPageDto;
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
public class StaffOrderServiceImpl implements StaffOrderService {

    private final JdbcTemplate jdbcTemplate;
    private final SimpMessagingTemplate messagingTemplate;

    private static final int MAX_PAGE_SIZE = 100;

    @Override
    @Transactional(readOnly = true)
    public StaffOrderPageDto listOrders(StaffOrderFilterRequest filter) {
        int page = Math.max(0, filter.getPage());
        int size = Math.min(Math.max(1, filter.getSize()), MAX_PAGE_SIZE);
        int offset = page * size;

        List<String> conditions = new ArrayList<>();
        List<Object> params = new ArrayList<>();

        if (StringUtils.hasText(filter.getStatus())) {
            conditions.add("LOWER(o.order_status) = LOWER(?)");
            params.add(filter.getStatus());
        }
        if (StringUtils.hasText(filter.getPaymentStatus())) {
            conditions.add("LOWER(o.payment_status) = LOWER(?)");
            params.add(filter.getPaymentStatus());
        }
        if (filter.getDateFrom() != null) {
            conditions.add("DATE(o.created_at) >= ?");
            params.add(filter.getDateFrom());
        }
        if (filter.getDateTo() != null) {
            conditions.add("DATE(o.created_at) <= ?");
            params.add(filter.getDateTo());
        }
        if (StringUtils.hasText(filter.getShipperUserId())) {
            conditions.add("o.shipper_user_id::text = ?");
            params.add(filter.getShipperUserId().trim());
        }
        if (StringUtils.hasText(filter.getSupplierProductId())) {
            conditions.add("EXISTS (SELECT 1 FROM order_items oi WHERE oi.order_id = o.id AND oi.product_id = ?)");
            params.add(filter.getSupplierProductId().trim());
        }

        String whereClause = conditions.isEmpty() ? "" : " WHERE " + String.join(" AND ", conditions);

        String countSql = "SELECT COUNT(*) FROM orders o" + whereClause;
        Long total = jdbcTemplate.queryForObject(countSql, Long.class, params.toArray());
        if (total == null) total = 0L;

        String dataSql = """
                SELECT o.id,
                       o.order_number,
                       o.customer_email,
                       o.customer_first_name,
                       o.customer_last_name,
                       o.customer_phone,
                       o.shipping_address_line1,
                       o.shipping_address_line2,
                       o.shipping_city,
                       o.shipping_state,
                       o.shipping_postal_code,
                       o.shipping_country,
                       o.subtotal,
                       o.shipping_fee,
                       o.vat,
                       o.discount_amount,
                       o.total_amount,
                       o.currency,
                       o.payment_method,
                       o.payment_status,
                       o.order_status,
                       o.shipping_carrier,
                       o.shipping_tracking_public,
                       o.shipper_user_id::text AS shipper_user_id,
                       s.email              AS shipper_email,
                       s.first_name         AS shipper_first_name,
                       s.last_name          AS shipper_last_name,
                       o.expected_delivery_at,
                       o.picked_up_at,
                       o.delivered_at,
                       o.failed_at,
                       o.delivery_success,
                       o.failure_reason,
                       o.shipped_at,
                       o.created_at,
                       o.updated_at,
                       COALESCE((SELECT SUM(oi.quantity) FROM order_items oi WHERE oi.order_id = o.id), 0) AS item_count
                FROM orders o
                LEFT JOIN users s ON s.users_id = o.shipper_user_id
                """ + whereClause + """
                 ORDER BY o.created_at DESC
                 LIMIT ? OFFSET ?
                """;

        List<Object> dataParams = new ArrayList<>(params);
        dataParams.add(size);
        dataParams.add(offset);

        List<StaffOrderDto> content = jdbcTemplate.query(
                dataSql,
                (rs, rowNum) -> new StaffOrderDto(
                        rs.getLong("id"),
                        rs.getString("order_number"),
                        rs.getString("customer_email"),
                        rs.getString("customer_first_name"),
                        rs.getString("customer_last_name"),
                        rs.getString("customer_phone"),
                        rs.getString("shipping_address_line1"),
                        rs.getString("shipping_address_line2"),
                        rs.getString("shipping_city"),
                        rs.getString("shipping_state"),
                        rs.getString("shipping_postal_code"),
                        rs.getString("shipping_country"),
                        rs.getBigDecimal("subtotal"),
                        rs.getBigDecimal("shipping_fee"),
                        rs.getBigDecimal("vat"),
                        rs.getBigDecimal("discount_amount"),
                        rs.getBigDecimal("total_amount"),
                        rs.getString("currency"),
                        rs.getString("payment_method"),
                        rs.getString("payment_status"),
                        rs.getString("order_status"),
                        rs.getString("shipping_carrier"),
                        rs.getString("shipping_tracking_public"),
                        rs.getString("shipper_user_id"),
                        rs.getString("shipper_email"),
                        rs.getString("shipper_first_name"),
                        rs.getString("shipper_last_name"),
                        toLocalDateTime(rs.getTimestamp("expected_delivery_at")),
                        toLocalDateTime(rs.getTimestamp("picked_up_at")),
                        toLocalDateTime(rs.getTimestamp("delivered_at")),
                        toLocalDateTime(rs.getTimestamp("failed_at")),
                        rs.getObject("delivery_success") == null ? null : rs.getBoolean("delivery_success"),
                        rs.getString("failure_reason"),
                        toLocalDateTime(rs.getTimestamp("shipped_at")),
                        toLocalDateTime(rs.getTimestamp("created_at")),
                        toLocalDateTime(rs.getTimestamp("updated_at")),
                        rs.getInt("item_count")
                ),
                dataParams.toArray()
        );

        int totalPages = size == 0 ? 0 : (int) Math.ceil((double) total / size);
        return new StaffOrderPageDto(content, total, page, size, totalPages);
    }

    @Override
    @Transactional
    public void overrideOrderStatus(Long orderId, String orderStatus, String paymentStatus, String reason, String changedBy) {
        if (!StringUtils.hasText(orderStatus) && !StringUtils.hasText(paymentStatus)) {
            throw new BusinessException("At least one of orderStatus or paymentStatus must be provided", HttpStatus.BAD_REQUEST);
        }

        List<Map<String, Object>> snapshot = jdbcTemplate.queryForList(
                "SELECT order_number, order_status, payment_status FROM orders WHERE id = ?", orderId
        );
        if (snapshot.isEmpty()) {
            throw new BusinessException("Order not found: " + orderId, HttpStatus.NOT_FOUND);
        }

        String prevOrderStatus = (String) snapshot.get(0).get("order_status");
        String prevPaymentStatus = (String) snapshot.get(0).get("payment_status");
        String orderNumber = (String) snapshot.get(0).get("order_number");

        LocalDateTime now = LocalDateTime.now();
        List<String> setClauses = new ArrayList<>();
        List<Object> params = new ArrayList<>();

        if (StringUtils.hasText(orderStatus)) {
            setClauses.add("order_status = ?");
            params.add(orderStatus.toLowerCase());
        }
        if (StringUtils.hasText(paymentStatus)) {
            setClauses.add("payment_status = ?");
            params.add(paymentStatus.toLowerCase());
        }
        setClauses.add("updated_at = ?");
        params.add(Timestamp.valueOf(now));
        params.add(orderId);

        jdbcTemplate.update(
                "UPDATE orders SET " + String.join(", ", setClauses) + " WHERE id = ?",
                params.toArray()
        );

        // Append to order_status_logs
        if (StringUtils.hasText(orderStatus)) {
            jdbcTemplate.update(
                    "INSERT INTO order_status_logs (order_id, previous_status, new_status, note, changed_by, created_at) VALUES (?, ?, ?, ?, ?, ?)",
                    orderId, prevOrderStatus, orderStatus.toLowerCase(), reason, changedBy, Timestamp.valueOf(now)
            );
        }
        if (StringUtils.hasText(paymentStatus)) {
            jdbcTemplate.update(
                    "INSERT INTO order_status_logs (order_id, previous_status, new_status, note, changed_by, created_at) VALUES (?, ?, ?, ?, ?, ?)",
                    orderId, prevPaymentStatus, "payment:" + paymentStatus.toLowerCase(), reason, changedBy, Timestamp.valueOf(now)
            );
        }

        // Broadcast real-time update via WebSocket
        try {
            Map<String, Object> event = new java.util.LinkedHashMap<>();
            event.put("orderId", orderId);
            event.put("orderNumber", orderNumber);
            event.put("orderStatus", StringUtils.hasText(orderStatus) ? orderStatus : prevOrderStatus);
            event.put("paymentStatus", StringUtils.hasText(paymentStatus) ? paymentStatus : prevPaymentStatus);
            event.put("changedBy", changedBy);
            messagingTemplate.convertAndSend("/topic/staff/orders", event);
        } catch (Exception ex) {
            log.warn("Failed to broadcast order status change for order {}: {}", orderId, ex.getMessage());
        }
    }

    private LocalDateTime toLocalDateTime(Timestamp ts) {
        return ts == null ? null : ts.toLocalDateTime();
    }
}
