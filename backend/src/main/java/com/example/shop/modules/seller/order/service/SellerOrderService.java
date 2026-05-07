package com.example.shop.modules.seller.order.service;

import com.example.shop.modules.seller.order.dto.SellerOrderDto;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class SellerOrderService {

    private final JdbcTemplate jdbcTemplate;

    public List<SellerOrderDto> listOrdersForSeller(UUID sellerUserId, int limit) {
        int safeLimit = Math.max(1, Math.min(limit, 500));
        return jdbcTemplate.query(
                """
                SELECT
                    o.order_number,
                    oi.product_id,
                    oi.product_name,
                    oi.quantity,
                    oi.line_total,
                    o.order_status,
                    o.payment_status,
                    o.created_at
                FROM order_items oi
                INNER JOIN orders o ON o.id = oi.order_id
                INNER JOIN products p ON p.product_id = oi.product_id
                WHERE p.supplier_user_id = ?::uuid
                ORDER BY o.created_at DESC
                LIMIT ?
                """,
                (rs, rowNum) -> SellerOrderDto.builder()
                        .orderNumber(rs.getString("order_number"))
                        .productId(rs.getString("product_id"))
                        .productName(rs.getString("product_name"))
                        .quantity(rs.getInt("quantity"))
                        .lineTotal(rs.getBigDecimal("line_total"))
                        .orderStatus(rs.getString("order_status"))
                        .paymentStatus(rs.getString("payment_status"))
                        .createdAt(rs.getTimestamp("created_at").toLocalDateTime())
                        .build(),
                sellerUserId.toString(), safeLimit
        );
    }
}
