package com.example.shop.modules.coupon.service;

import com.example.shop.modules.coupon.entity.Coupon;
import com.example.shop.modules.coupon.entity.CouponAssignment;
import com.example.shop.modules.coupon.repository.CouponAssignmentRepository;
import com.example.shop.modules.coupon.repository.CouponRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
@Slf4j
public class CouponService {

    private final CouponRepository couponRepository;
    private final CouponAssignmentRepository couponAssignmentRepository;
    private final JdbcTemplate jdbcTemplate;

    // ──────────────────────────────────────────────
    // Admin: list
    // ──────────────────────────────────────────────

    public Page<Coupon> listCoupons(int page, int size, String q) {
        String likeQ = (q != null && !q.isBlank()) ? "%" + q.trim().toLowerCase() + "%" : null;
        return couponRepository.searchCoupons(likeQ, PageRequest.of(page, size));
    }

    // ──────────────────────────────────────────────
    // Admin: CRUD
    // ──────────────────────────────────────────────

    @Transactional
    public Coupon createCoupon(Map<String, Object> data) {
        String code = toStr(data.get("code")).toUpperCase();
        String title = toStr(data.get("title"));
        String description = toStr(data.get("description"));
        String discountType = normalizeDiscountType(toStr(data.get("discount_type")));
        BigDecimal discountValue = toBigDecimal(data.get("discount_value"));
        BigDecimal minOrderAmount = toBigDecimalOrZero(data.get("min_order_amount"));
        BigDecimal maxDiscountAmount = toBigDecimalOrNull(data.get("max_discount_amount"));
        Integer usageLimit = toIntOrNull(data.get("usage_limit"));
        LocalDateTime startsAt = toDateTimeOrNull(data.get("starts_at"));
        LocalDateTime expiresAt = toDateTimeOrNull(data.get("expires_at"));
        boolean isActive = data.get("is_active") == null || !Boolean.FALSE.equals(data.get("is_active"));

        if (code.isEmpty() || title.isEmpty() || discountType == null) {
            throw new IllegalArgumentException("code, title and discount_type are required");
        }
        if (discountValue == null || discountValue.compareTo(BigDecimal.ZERO) <= 0) {
            throw new IllegalArgumentException("discount_value must be > 0");
        }
        if ("percentage".equals(discountType) && discountValue.compareTo(new BigDecimal("100")) > 0) {
            throw new IllegalArgumentException("percentage discount cannot exceed 100");
        }

        Coupon coupon = Coupon.builder()
                .code(code)
                .title(title)
                .description(description.isEmpty() ? null : description)
                .discountType(discountType)
                .discountValue(discountValue)
                .minOrderAmount(minOrderAmount)
                .maxDiscountAmount(maxDiscountAmount)
                .usageLimit(usageLimit)
                .usageCount(0)
                .startsAt(startsAt)
                .expiresAt(expiresAt)
                .isActive(isActive)
                .createdAt(LocalDateTime.now())
                .updatedAt(LocalDateTime.now())
                .build();
        return couponRepository.save(coupon);
    }

    @Transactional
    public Coupon updateCoupon(Long id, Map<String, Object> data) {
        Coupon coupon = couponRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Coupon not found: " + id));

        if (data.containsKey("code")) coupon.setCode(toStr(data.get("code")).toUpperCase());
        if (data.containsKey("title")) coupon.setTitle(toStr(data.get("title")));
        if (data.containsKey("description")) {
            String d = toStr(data.get("description"));
            coupon.setDescription(d.isEmpty() ? null : d);
        }
        if (data.containsKey("discount_type")) {
            String dt = normalizeDiscountType(toStr(data.get("discount_type")));
            if (dt == null) throw new IllegalArgumentException("Invalid discount_type");
            coupon.setDiscountType(dt);
        }
        if (data.containsKey("discount_value")) {
            BigDecimal val = toBigDecimal(data.get("discount_value"));
            if (val == null || val.compareTo(BigDecimal.ZERO) <= 0) throw new IllegalArgumentException("discount_value must be > 0");
            coupon.setDiscountValue(val);
        }
        if (data.containsKey("min_order_amount")) coupon.setMinOrderAmount(toBigDecimalOrZero(data.get("min_order_amount")));
        if (data.containsKey("max_discount_amount")) coupon.setMaxDiscountAmount(toBigDecimalOrNull(data.get("max_discount_amount")));
        if (data.containsKey("usage_limit")) coupon.setUsageLimit(toIntOrNull(data.get("usage_limit")));
        if (data.containsKey("starts_at")) coupon.setStartsAt(toDateTimeOrNull(data.get("starts_at")));
        if (data.containsKey("expires_at")) coupon.setExpiresAt(toDateTimeOrNull(data.get("expires_at")));
        if (data.containsKey("is_active")) coupon.setIsActive(Boolean.TRUE.equals(data.get("is_active")));
        coupon.setUpdatedAt(LocalDateTime.now());
        return couponRepository.save(coupon);
    }

    // ──────────────────────────────────────────────
    // Admin: issue coupon to a user
    // ──────────────────────────────────────────────

    @Transactional
    public CouponAssignment issueCoupon(Long couponId, String userId, String userEmail,
                                        String notificationTitle, String notificationMessage, String issuedByEmail) {
        Coupon coupon = couponRepository.findById(couponId)
                .orElseThrow(() -> new IllegalArgumentException("Coupon not found: " + couponId));

        CouponAssignment assignment = CouponAssignment.builder()
                .coupon(coupon)
                .userId(userId)
                .userEmail(userEmail)
                .notificationTitle(notificationTitle)
                .notificationMessage(notificationMessage)
                .issuedByEmail(issuedByEmail)
                .issuedAt(LocalDateTime.now())
                .createdAt(LocalDateTime.now())
                .updatedAt(LocalDateTime.now())
                .build();
        return couponAssignmentRepository.save(assignment);
    }

    // ──────────────────────────────────────────────
    // Customer: validate coupon
    // ──────────────────────────────────────────────

    public record ValidatedCoupon(
            Long couponId,
            Long assignmentId,
            String code,
            String title,
            String discountType,
            BigDecimal discountValue,
            BigDecimal discountAmount
    ) {}

    public ValidatedCoupon validateCoupon(String code, String userId, BigDecimal subtotal) {
        String normalizedCode = code.trim().toUpperCase();
        if (normalizedCode.isEmpty()) throw new IllegalArgumentException("Coupon code is required");
        if (subtotal == null || subtotal.compareTo(BigDecimal.ZERO) < 0) throw new IllegalArgumentException("Invalid subtotal");

        Coupon coupon = couponRepository.findByCode(normalizedCode)
                .orElseThrow(() -> new IllegalArgumentException("Coupon not found"));
        if (!Boolean.TRUE.equals(coupon.getIsActive())) throw new IllegalArgumentException("Coupon is inactive");

        long assignmentCount = couponAssignmentRepository.countByCouponId(coupon.getId());
        CouponAssignment assignment = null;
        if (assignmentCount > 0) {
            if (userId == null || userId.isBlank()) throw new IllegalArgumentException("Sign in to use this coupon");
            List<CouponAssignment> assignments = couponAssignmentRepository
                    .findByCouponIdAndUserIdOrderByIssuedAtDesc(coupon.getId(), userId);
            assignment = assignments.stream().findFirst().orElse(null);
            if (assignment == null) throw new IllegalArgumentException("This coupon was not issued to your account");
            if (assignment.getUsedAt() != null) throw new IllegalArgumentException("This coupon has already been used");
            if (assignment.getAcknowledgedAt() == null) throw new IllegalArgumentException("Confirm receipt of this coupon before applying it");
        }

        LocalDateTime now = LocalDateTime.now();
        if (coupon.getStartsAt() != null && now.isBefore(coupon.getStartsAt())) throw new IllegalArgumentException("Coupon is not active yet");
        if (coupon.getExpiresAt() != null && now.isAfter(coupon.getExpiresAt())) throw new IllegalArgumentException("Coupon has expired");
        if (coupon.getUsageLimit() != null && coupon.getUsageCount() >= coupon.getUsageLimit()) throw new IllegalArgumentException("Coupon usage limit reached");
        if (subtotal.compareTo(coupon.getMinOrderAmount() != null ? coupon.getMinOrderAmount() : BigDecimal.ZERO) < 0) {
            throw new IllegalArgumentException("Minimum order for this coupon is $" + coupon.getMinOrderAmount().toPlainString());
        }

        BigDecimal rawDiscount = "percentage".equals(coupon.getDiscountType())
                ? subtotal.multiply(coupon.getDiscountValue()).divide(new BigDecimal("100"), 2, RoundingMode.HALF_UP)
                : coupon.getDiscountValue();
        if (coupon.getMaxDiscountAmount() != null) rawDiscount = rawDiscount.min(coupon.getMaxDiscountAmount());
        BigDecimal discountAmount = rawDiscount.min(subtotal).max(BigDecimal.ZERO).setScale(2, RoundingMode.HALF_UP);

        return new ValidatedCoupon(coupon.getId(), assignment != null ? assignment.getId() : null,
                coupon.getCode(), coupon.getTitle(), coupon.getDiscountType(), coupon.getDiscountValue(), discountAmount);
    }

    // ──────────────────────────────────────────────
    // Customer: redeem coupon (called on order)
    // ──────────────────────────────────────────────

    @Transactional
    public ValidatedCoupon redeemCoupon(Long orderId, String code, String userId, BigDecimal subtotal) {
        ValidatedCoupon validated = validateCoupon(code, userId, subtotal);

        Coupon coupon = couponRepository.findById(validated.couponId()).orElseThrow();
        coupon.setUsageCount(coupon.getUsageCount() + 1);
        coupon.setUpdatedAt(LocalDateTime.now());
        couponRepository.save(coupon);

        if (validated.assignmentId() != null) {
            CouponAssignment assignment = couponAssignmentRepository.findById(validated.assignmentId()).orElseThrow();
            if (assignment.getUsedAt() != null) throw new IllegalArgumentException("This coupon has already been used");
            assignment.setUsedAt(LocalDateTime.now());
            assignment.setUsedOrderId(orderId);
            assignment.setUpdatedAt(LocalDateTime.now());
            couponAssignmentRepository.save(assignment);
        }
        return validated;
    }

    @Transactional
    public void redeemCouponForPaidOrder(Long orderId) {
        if (orderId == null || orderId <= 0) {
            return;
        }

        OrderCouponSnapshot order = jdbcTemplate.query(
                """
                SELECT id, coupon_code, coupon_assignment_id, payment_status
                FROM orders
                WHERE id = ?
                LIMIT 1
                """,
                (rs, rowNum) -> new OrderCouponSnapshot(
                        rs.getLong("id"),
                        rs.getString("coupon_code"),
                        rs.getObject("coupon_assignment_id") == null ? null : rs.getLong("coupon_assignment_id"),
                        rs.getString("payment_status")
                ),
                orderId
        ).stream().findFirst().orElse(null);

        if (order == null || order.couponCode() == null || order.couponCode().isBlank()) {
            return;
        }

        if (!"paid".equalsIgnoreCase(order.paymentStatus())) {
            log.warn("Skipping coupon redemption for order {} because payment_status is {}", orderId, order.paymentStatus());
            return;
        }

        Coupon coupon = couponRepository.findByCode(order.couponCode().trim().toUpperCase()).orElse(null);
        if (coupon == null) {
            log.warn("Coupon {} was stored on order {} but no longer exists", order.couponCode(), orderId);
            return;
        }

        if (order.couponAssignmentId() != null) {
            CouponAssignment assignment = couponAssignmentRepository.findById(order.couponAssignmentId()).orElse(null);
            if (assignment == null) {
                log.warn("Coupon assignment {} was stored on order {} but no longer exists", order.couponAssignmentId(), orderId);
                return;
            }
            if (assignment.getUsedAt() != null) {
                if (orderId.equals(assignment.getUsedOrderId())) {
                    return;
                }
                throw new IllegalStateException("Coupon assignment " + assignment.getId() + " is already linked to order " + assignment.getUsedOrderId());
            }

            coupon.setUsageCount(coupon.getUsageCount() + 1);
            coupon.setUpdatedAt(LocalDateTime.now());
            couponRepository.save(coupon);

            assignment.setUsedAt(LocalDateTime.now());
            assignment.setUsedOrderId(orderId);
            assignment.setUpdatedAt(LocalDateTime.now());
            couponAssignmentRepository.save(assignment);
            return;
        }

        coupon.setUsageCount(coupon.getUsageCount() + 1);
        coupon.setUpdatedAt(LocalDateTime.now());
        couponRepository.save(coupon);
    }

    // ──────────────────────────────────────────────
    // Customer: notifications (coupon assignments)
    // ──────────────────────────────────────────────

    @Transactional
    public List<CouponAssignment> getUserNotifications(String userId) {
        return couponAssignmentRepository.findByUserIdWithCoupon(userId);
    }

    @Transactional
    public void acknowledgeAssignment(Long assignmentId, String userId) {
        CouponAssignment assignment = couponAssignmentRepository.findById(assignmentId)
                .orElseThrow(() -> new IllegalArgumentException("Assignment not found"));
        if (!assignment.getUserId().equals(userId)) throw new IllegalArgumentException("Forbidden");
        if (assignment.getAcknowledgedAt() == null) {
            assignment.setAcknowledgedAt(LocalDateTime.now());
            assignment.setUpdatedAt(LocalDateTime.now());
            couponAssignmentRepository.save(assignment);
        }
    }

    // ──────────────────────────────────────────────
    // Helpers
    // ──────────────────────────────────────────────

    private String normalizeDiscountType(String value) {
        if ("percentage".equalsIgnoreCase(value) || "fixed".equalsIgnoreCase(value)) return value.toLowerCase();
        return null;
    }

    private String toStr(Object o) { return o != null ? o.toString().trim() : ""; }

    private BigDecimal toBigDecimal(Object o) {
        if (o == null) return null;
        try { return new BigDecimal(o.toString()); } catch (Exception e) { return null; }
    }

    private BigDecimal toBigDecimalOrZero(Object o) {
        BigDecimal v = toBigDecimal(o);
        return v != null && v.compareTo(BigDecimal.ZERO) > 0 ? v : BigDecimal.ZERO;
    }

    private BigDecimal toBigDecimalOrNull(Object o) {
        if (o == null) return null;
        BigDecimal v = toBigDecimal(o);
        return (v != null && v.compareTo(BigDecimal.ZERO) > 0) ? v : null;
    }

    private Integer toIntOrNull(Object o) {
        if (o == null) return null;
        try {
            int v = Integer.parseInt(o.toString());
            return v > 0 ? v : null;
        } catch (Exception e) { return null; }
    }

    private LocalDateTime toDateTimeOrNull(Object o) {
        if (o == null || o.toString().isBlank()) return null;
        try { return LocalDateTime.parse(o.toString().replace(" ", "T")); } catch (Exception e) { return null; }
    }

    private record OrderCouponSnapshot(
            Long id,
            String couponCode,
            Long couponAssignmentId,
            String paymentStatus
    ) {}
}
