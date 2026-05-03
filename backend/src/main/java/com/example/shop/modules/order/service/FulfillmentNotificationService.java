package com.example.shop.modules.order.service;

import com.example.shop.common.mail.EmailService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

@Service
@RequiredArgsConstructor
@Slf4j
public class FulfillmentNotificationService {

    private final JdbcTemplate jdbcTemplate;
    private final EmailService emailService;

    @Value("${application.bootstrap.admin.email:}")
    private String adminEmail;

    @Value("${application.fulfillment.delivery-reminder.enabled:true}")
    private boolean reminderEnabled;

    public void notifyShippersOrderPaid(Long orderId, String orderNumber, String customerEmail) {
        Set<String> recipients = resolveShipperRecipients();
        if (recipients.isEmpty()) {
            log.warn("No shipper recipients found for paid order {}", orderNumber);
            return;
        }

        String subject = "New paid order ready to ship - " + safe(orderNumber);
        String content = """
                <html>
                  <body style="font-family:Arial,sans-serif;color:#111;max-width:600px;margin:0 auto;">
                    <div style="background:linear-gradient(135deg,#1e3a5f,#2563eb);padding:24px;border-radius:12px 12px 0 0;">
                      <h2 style="color:#fff;margin:0;">Paid Order Ready for Fulfillment</h2>
                    </div>
                    <div style="padding:24px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 12px 12px;">
                      <p>Order <strong>%s</strong> has been paid and is ready to ship.</p>
                      <p>Customer: %s</p>
                      <p>Please open the shipping queue and dispatch this order.</p>
                    </div>
                  </body>
                </html>
                """.formatted(esc(safe(orderNumber)), esc(safe(customerEmail)));

        for (String recipient : recipients) {
            try {
                emailService.sendEmail(recipient, subject, content);
            } catch (Exception ex) {
                log.error("Failed to send paid-order shipper notification to {}", recipient, ex);
            }
        }
        log.info("Sent paid-order shipper notification for order {} to {} recipients", orderNumber, recipients.size());
    }

    @Scheduled(cron = "${application.fulfillment.delivery-reminder.cron:0 */30 * * * *}")
    public void sendUndeliveredPaidOrderReminders() {
        if (!reminderEnabled) {
            return;
        }
        processReminderForDay(2);
        processReminderForDay(3);
    }

    private void processReminderForDay(int day) {
        List<ReminderRow> rows = jdbcTemplate.query(
                """
                SELECT o.id, o.order_number, o.customer_email, o.created_at
                FROM orders o
                WHERE LOWER(o.payment_status) = 'paid'
                  AND LOWER(o.order_status) NOT IN ('completed', 'cancelled')
                  AND o.created_at <= (CURRENT_TIMESTAMP - (? * INTERVAL '1 day'))
                  AND NOT EXISTS (
                    SELECT 1 FROM order_delivery_reminders r
                    WHERE r.order_id = o.id AND r.reminder_day = ?
                  )
                ORDER BY o.created_at ASC
                LIMIT 100
                """,
                (rs, idx) -> new ReminderRow(
                        rs.getLong("id"),
                        rs.getString("order_number"),
                        rs.getString("customer_email"),
                        rs.getTimestamp("created_at") == null
                                ? null
                                : rs.getTimestamp("created_at").toLocalDateTime()
                ),
                day,
                day
        );

        if (rows.isEmpty()) {
            return;
        }

        Set<String> recipients = resolveShipperRecipients();
        if (recipients.isEmpty()) {
            log.warn("Skipped {}-day delivery reminders because no shipper recipients were found", day);
            return;
        }

        for (ReminderRow row : rows) {
            String subject = "Delivery reminder (Day " + day + ") - " + safe(row.orderNumber());
            long ageDays = row.createdAt() == null ? day : ChronoUnit.DAYS.between(row.createdAt(), LocalDateTime.now());
            String content = """
                    <html>
                      <body style="font-family:Arial,sans-serif;color:#111;max-width:600px;margin:0 auto;">
                        <div style="background:linear-gradient(135deg,#92400e,#ea580c);padding:24px;border-radius:12px 12px 0 0;">
                          <h2 style="color:#fff;margin:0;">Undelivered Paid Order Reminder</h2>
                        </div>
                        <div style="padding:24px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 12px 12px;">
                          <p>Order <strong>%s</strong> has been paid for about <strong>%d day(s)</strong> and is not marked delivered yet.</p>
                          <p>Customer: %s</p>
                          <p>Please check shipping progress and update the order status.</p>
                        </div>
                      </body>
                    </html>
                    """.formatted(esc(safe(row.orderNumber())), Math.max(day, ageDays), esc(safe(row.customerEmail())));

            boolean sent = false;
            for (String recipient : recipients) {
                try {
                    emailService.sendEmail(recipient, subject, content);
                    sent = true;
                } catch (Exception ex) {
                    log.error("Failed to send {}-day reminder for order {} to {}", day, row.orderNumber(), recipient, ex);
                }
            }
            if (sent) {
                jdbcTemplate.update(
                        "INSERT INTO order_delivery_reminders (order_id, reminder_day) VALUES (?, ?) ON CONFLICT DO NOTHING",
                        row.orderId(),
                        day
                );
            }
        }
    }

    private Set<String> resolveShipperRecipients() {
        Set<String> recipients = new LinkedHashSet<>(jdbcTemplate.query(
                """
                SELECT DISTINCT u.email
                FROM users u
                JOIN user_roles ur ON ur.users_id = u.users_id
                JOIN roles r ON r.roles_id = ur.roles_id
                WHERE u.is_active = TRUE
                  AND LOWER(r.roles_name) = 'role_shipper'
                  AND u.email IS NOT NULL
                """,
                (rs, idx) -> safe(rs.getString("email")).toLowerCase()
        ));
        if (recipients.isEmpty() && StringUtils.hasText(adminEmail)) {
            recipients.add(adminEmail.trim().toLowerCase());
        }
        recipients.removeIf(v -> !StringUtils.hasText(v));
        return recipients;
    }

    private String safe(String value) {
        return value == null ? "" : value.trim();
    }

    private String esc(String value) {
        return safe(value)
                .replace("&", "&amp;")
                .replace("<", "&lt;")
                .replace(">", "&gt;")
                .replace("\"", "&quot;")
                .replace("'", "&#39;");
    }

    private record ReminderRow(Long orderId, String orderNumber, String customerEmail, LocalDateTime createdAt) {
    }
}
