package com.example.shop.modules.messaging.fraud;

import com.example.shop.config.ConditionalOnRabbitEnabled;
import com.example.shop.modules.messaging.email.EmailMessage;
import com.example.shop.modules.messaging.email.EmailMessagePublisher;
import com.example.shop.modules.messaging.order.OrderCreatedEvent;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

@Component
@RequiredArgsConstructor
@ConditionalOnRabbitEnabled
@Slf4j
public class FraudCheckConsumer {

    private static final BigDecimal HIGH_AMOUNT_THRESHOLD = new BigDecimal("500");
    private static final BigDecimal VERY_HIGH_AMOUNT_THRESHOLD = new BigDecimal("1000");

    private final JdbcTemplate jdbcTemplate;
    private final EmailMessagePublisher emailMessagePublisher;

    @Value("${application.bootstrap.admin.email:}")
    private String adminEmail;

    @RabbitListener(queues = "${application.messaging.queue.order-created-fraud-check}")
    @Transactional
    public void consume(OrderCreatedEvent event) {
        if (event == null || event.getOrderId() == null) {
            log.warn("Received null/incomplete order created event for fraud check");
            return;
        }

        FraudAssessment assessment = assess(event);
        Boolean previouslyManualReviewRequired = jdbcTemplate.query(
                "SELECT manual_review_required FROM fraud_order_assessments WHERE order_id = ?",
                rs -> rs.next() ? rs.getBoolean("manual_review_required") : null,
                event.getOrderId()
        );

        jdbcTemplate.update("""
                INSERT INTO fraud_order_assessments (
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
                    assessed_at,
                    updated_at
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                ON CONFLICT (order_id)
                DO UPDATE SET
                    order_number = EXCLUDED.order_number,
                    customer_email = EXCLUDED.customer_email,
                    payment_method = EXCLUDED.payment_method,
                    currency = EXCLUDED.currency,
                    total_amount = EXCLUDED.total_amount,
                    risk_score = EXCLUDED.risk_score,
                    risk_level = EXCLUDED.risk_level,
                    manual_review_required = EXCLUDED.manual_review_required,
                    risk_reasons = EXCLUDED.risk_reasons,
                    updated_at = CURRENT_TIMESTAMP
                """,
                event.getOrderId(),
                safe(event.getOrderNumber()),
                safe(event.getCustomerEmail()),
                assessment.paymentMethod(),
                assessment.currency(),
                assessment.totalAmount(),
                assessment.score(),
                assessment.level(),
                assessment.manualReviewRequired(),
                assessment.reasons()
        );

        boolean shouldAlert = assessment.manualReviewRequired()
                && (previouslyManualReviewRequired == null || !previouslyManualReviewRequired);
        if (shouldAlert) {
            publishHighRiskAlert(event, assessment);
        }

        log.info("Fraud assessment completed: order={} score={} level={} manualReview={}",
                event.getOrderNumber(), assessment.score(), assessment.level(), assessment.manualReviewRequired());
    }

    private FraudAssessment assess(OrderCreatedEvent event) {
        BigDecimal amount = event.getTotalAmount() == null ? BigDecimal.ZERO : event.getTotalAmount();
        String paymentMethod = normalizePaymentMethod(event.getPaymentMethod());
        String currency = normalizeCurrency(event.getCurrency());
        String email = safe(event.getCustomerEmail()).toLowerCase(Locale.ROOT);

        int score = 0;
        List<String> reasons = new ArrayList<>();

        if (amount.compareTo(VERY_HIGH_AMOUNT_THRESHOLD) >= 0) {
            score += 60;
            reasons.add("very_high_amount");
        } else if (amount.compareTo(HIGH_AMOUNT_THRESHOLD) >= 0) {
            score += 35;
            reasons.add("high_amount");
        }

        if (paymentMethod.equals("cod")) {
            score += 20;
            reasons.add("cash_on_delivery");
        }

        if (!email.contains("@") || email.startsWith("guest-")) {
            score += 20;
            reasons.add("guest_or_unverified_email_pattern");
        }

        if (email.endsWith("@mailinator.com") || email.endsWith("@10minutemail.com")) {
            score += 40;
            reasons.add("disposable_email_domain");
        }

        String level;
        if (score >= 70) {
            level = "high";
        } else if (score >= 35) {
            level = "medium";
        } else {
            level = "low";
        }

        boolean manualReviewRequired = score >= 70;
        String reasonText = reasons.isEmpty() ? "none" : String.join(",", reasons);

        return new FraudAssessment(amount, paymentMethod, currency, score, level, manualReviewRequired, reasonText);
    }

    private String normalizePaymentMethod(String paymentMethod) {
        if (paymentMethod == null || paymentMethod.isBlank()) {
            return "unknown";
        }
        return paymentMethod.trim().toLowerCase(Locale.ROOT);
    }

    private String normalizeCurrency(String currency) {
        if (currency == null || currency.isBlank()) {
            return "USD";
        }
        String upper = currency.trim().toUpperCase(Locale.ROOT);
        return upper.length() > 3 ? upper.substring(0, 3) : upper;
    }

    private String safe(String value) {
        return value == null ? "" : value.trim();
    }

    private void publishHighRiskAlert(OrderCreatedEvent event, FraudAssessment assessment) {
        if (adminEmail == null || adminEmail.isBlank()) {
            log.warn("High-risk order detected but admin email is not configured");
            return;
        }

        String subject = "High-risk order flagged: " + safe(event.getOrderNumber());
        String content = """
                <html>
                  <body style="font-family:Arial,sans-serif;color:#111;">
                    <h3>Fraud Check Alert</h3>
                    <p>An order has been flagged for manual review.</p>
                    <ul>
                      <li><strong>Order:</strong> %s</li>
                      <li><strong>Customer Email:</strong> %s</li>
                      <li><strong>Amount:</strong> %s %s</li>
                      <li><strong>Risk Score:</strong> %d</li>
                      <li><strong>Risk Level:</strong> %s</li>
                      <li><strong>Reasons:</strong> %s</li>
                    </ul>
                  </body>
                </html>
                """.formatted(
                safe(event.getOrderNumber()),
                safe(event.getCustomerEmail()),
                assessment.totalAmount(),
                assessment.currency(),
                assessment.score(),
                assessment.level(),
                assessment.reasons()
        );

        emailMessagePublisher.publish(EmailMessage.builder()
                .to(adminEmail)
                .subject(subject)
                .content(content)
                .emailType(EmailMessage.EmailType.GENERIC)
                .build());
    }

    private record FraudAssessment(
            BigDecimal totalAmount,
            String paymentMethod,
            String currency,
            int score,
            String level,
            boolean manualReviewRequired,
            String reasons
    ) {
    }
}
