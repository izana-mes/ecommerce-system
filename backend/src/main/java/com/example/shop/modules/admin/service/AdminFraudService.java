package com.example.shop.modules.admin.service;

import com.example.shop.modules.admin.dto.AdminFraudAssessmentPageResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.sql.Timestamp;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Set;

@Service
@RequiredArgsConstructor
@Slf4j
public class AdminFraudService {
    private static final Set<String> ALLOWED_REVIEW_STATUSES = Set.of("pending", "approved", "rejected");

    private static final DateTimeFormatter ISO_FORMATTER =
            DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH:mm:ss");

    private final JdbcTemplate jdbcTemplate;

    public AdminFraudAssessmentPageResponse getFraudAssessments(
            int page,
            int size,
            String riskLevel,
            Boolean manualReviewRequired,
            String orderNumber,
            String customerEmail
    ) {
        int safePage = Math.max(0, page);
        int safeSize = Math.min(100, Math.max(1, size));

        List<String> whereParts = new ArrayList<>();
        List<Object> whereParams = new ArrayList<>();

        if (StringUtils.hasText(riskLevel)) {
            whereParts.add("risk_level = ?");
            whereParams.add(riskLevel.trim().toLowerCase(Locale.ROOT));
        }
        if (manualReviewRequired != null) {
            whereParts.add("manual_review_required = ?");
            whereParams.add(manualReviewRequired);
        }
        if (StringUtils.hasText(orderNumber)) {
            whereParts.add("order_number ILIKE ?");
            whereParams.add("%" + orderNumber.trim() + "%");
        }
        if (StringUtils.hasText(customerEmail)) {
            whereParts.add("customer_email ILIKE ?");
            whereParams.add("%" + customerEmail.trim() + "%");
        }

        String whereSql = whereParts.isEmpty() ? "" : "WHERE " + String.join(" AND ", whereParts);

        try {
            Long total = jdbcTemplate.queryForObject(
                    "SELECT COUNT(*) FROM fraud_order_assessments " + whereSql,
                    Long.class,
                    whereParams.toArray()
            );
            long totalElements = total == null ? 0L : total;
            long totalPages = Math.max(1, (long) Math.ceil((double) totalElements / safeSize));

            List<Object> pageParams = new ArrayList<>(whereParams);
            pageParams.add(safeSize);
            pageParams.add((long) safePage * safeSize);

            List<AdminFraudAssessmentPageResponse.Item> content = jdbcTemplate.query(
                    """
                    SELECT
                        order_id,
                        order_number,
                        customer_email,
                        payment_method,
                        currency,
                        total_amount,
                        risk_score,
                        risk_level,
                        manual_review_required,
                        risk_reasons,
                        review_status,
                        review_note,
                        reviewed_by,
                        reviewed_at,
                        assessed_at,
                        updated_at
                    FROM fraud_order_assessments
                    """ + whereSql +
                    " ORDER BY assessed_at DESC LIMIT ? OFFSET ?",
                    (rs, rowNum) -> {
                        Timestamp assessedAt = rs.getTimestamp("assessed_at");
                        Timestamp updatedAt = rs.getTimestamp("updated_at");
                        return new AdminFraudAssessmentPageResponse.Item(
                                rs.getLong("order_id"),
                                rs.getString("order_number"),
                                rs.getString("customer_email"),
                                rs.getString("payment_method"),
                                rs.getString("currency"),
                                rs.getBigDecimal("total_amount"),
                                rs.getInt("risk_score"),
                                rs.getString("risk_level"),
                                rs.getBoolean("manual_review_required"),
                                rs.getString("risk_reasons"),
                                rs.getString("review_status"),
                                rs.getString("review_note"),
                                rs.getString("reviewed_by"),
                                rs.getTimestamp("reviewed_at") == null ? null : rs.getTimestamp("reviewed_at").toLocalDateTime().format(ISO_FORMATTER),
                                assessedAt == null ? null : assessedAt.toLocalDateTime().format(ISO_FORMATTER),
                                updatedAt == null ? null : updatedAt.toLocalDateTime().format(ISO_FORMATTER)
                        );
                    },
                    pageParams.toArray()
            );

            return new AdminFraudAssessmentPageResponse(
                    content,
                    totalElements,
                    totalPages,
                    safePage,
                    safeSize,
                    false
            );
        } catch (DataAccessException ex) {
            log.error("Failed to query fraud_order_assessments: {}", ex.getMessage());
            return new AdminFraudAssessmentPageResponse(
                    List.of(),
                    0L,
                    1L,
                    safePage,
                    safeSize,
                    true
            );
        }
    }

    public boolean reviewAssessment(long orderId, String reviewStatus, String reviewNote, String reviewedBy) {
        String normalizedStatus = reviewStatus == null ? "" : reviewStatus.trim().toLowerCase(Locale.ROOT);
        if (!ALLOWED_REVIEW_STATUSES.contains(normalizedStatus)) {
            throw new IllegalArgumentException("Invalid reviewStatus. Allowed: pending, approved, rejected");
        }

        String normalizedNote = reviewNote == null ? null : reviewNote.trim();
        if (normalizedNote != null && normalizedNote.length() > 2000) {
            normalizedNote = normalizedNote.substring(0, 2000);
        }

        int updated = jdbcTemplate.update(
                """
                UPDATE fraud_order_assessments
                SET review_status = ?,
                    review_note = ?,
                    reviewed_by = ?,
                    reviewed_at = CURRENT_TIMESTAMP,
                    updated_at = CURRENT_TIMESTAMP
                WHERE order_id = ?
                """,
                normalizedStatus,
                normalizedNote,
                reviewedBy,
                orderId
        );
        return updated > 0;
    }
}
