package com.example.shop.modules.seller.order.service;

import com.example.shop.modules.seller.order.dto.SellerOrderDto;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/**
 * Implementation of {@link SellerOrderService}.
 *
 * <p>Uses raw JDBC for flexibility with the legacy schema while keeping
 * the rest of the seller module on Spring Data JPA.
 */
@Slf4j
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class SellerOrderServiceImpl implements SellerOrderService {

    private final JdbcTemplate jdbcTemplate;

    /**
     * {@inheritDoc}
     *
     * <p>Fixed columns vs. original implementation:
     * <ul>
     *   <li>JOIN is now on {@code products.seller_user_id} (not the old
     *       {@code supplier_user_id} which caused an always-empty result set).</li>
     *   <li>Adds computed aliases {@code customer_name} and {@code shipping_address}
     *       from normalized order columns.</li>
     *   <li>Added optional ORDER-STATUS filter.</li>
     * </ul>
     */
    @SuppressWarnings("null")
    @Override
    public List<SellerOrderDto> listOrdersForSeller(UUID sellerUserId, int limit, String status) {
        int safeLimit = Math.max(1, Math.min(limit, 500));
        boolean filterByStatus = StringUtils.hasText(status);

        StringBuilder sql = new StringBuilder("""
                SELECT
                    o.order_number,
                    oi.product_id,
                    oi.product_name,
                    oi.quantity,
                    oi.line_total,
                    o.order_status,
                    o.payment_status,
                    o.created_at,
                    TRIM(CONCAT(COALESCE(o.customer_first_name, ''), ' ', COALESCE(o.customer_last_name, ''))) AS customer_name,
                    TRIM(CONCAT_WS(', ',
                        NULLIF(o.shipping_address_line1, ''),
                        NULLIF(o.shipping_address_line2, ''),
                        NULLIF(o.shipping_city, ''),
                        NULLIF(o.shipping_state, ''),
                        NULLIF(o.shipping_postal_code, ''),
                        NULLIF(o.shipping_country, '')
                    )) AS shipping_address
                FROM order_items oi
                INNER JOIN orders o ON o.id = oi.order_id
                INNER JOIN products p ON p.product_id = oi.product_id
                WHERE p.seller_user_id = ?
                """);

        List<Object> params = new ArrayList<>();
        params.add(sellerUserId);

        if (filterByStatus) {
            sql.append(" AND UPPER(o.order_status) = UPPER(?) ");
            params.add(status.trim());
        }

        sql.append(" ORDER BY o.created_at DESC LIMIT ? ");
        params.add(safeLimit);

        return jdbcTemplate.query(
                sql.toString(),
                (rs, rowNum) -> SellerOrderDto.builder()
                        .orderNumber(rs.getString("order_number"))
                        .productId(rs.getString("product_id"))
                        .productName(rs.getString("product_name"))
                        .quantity(rs.getInt("quantity"))
                        .lineTotal(rs.getBigDecimal("line_total"))
                        .orderStatus(rs.getString("order_status"))
                        .paymentStatus(rs.getString("payment_status"))
                        .createdAt(rs.getTimestamp("created_at") != null
                                ? rs.getTimestamp("created_at").toLocalDateTime()
                                : null)
                        .customerName(rs.getString("customer_name"))
                        .shippingAddress(rs.getString("shipping_address"))
                        .build(),
                params.toArray()
        );
    }
}
