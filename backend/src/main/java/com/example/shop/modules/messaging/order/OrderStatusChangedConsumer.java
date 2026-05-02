package com.example.shop.modules.messaging.order;

import com.example.shop.common.mail.EmailService;
import com.example.shop.config.ConditionalOnRabbitEnabled;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

import java.util.Map;

@Component
@RequiredArgsConstructor
@ConditionalOnRabbitEnabled
@Slf4j
public class OrderStatusChangedConsumer {

    private final EmailService emailService;

    @Value("${application.bootstrap.admin.email}")
    private String adminEmail;

    private static final Map<String, String> STATUS_LABELS = Map.of(
            "processing", "Being Processed",
            "shipped", "Shipped",
            "completed", "Delivered",
            "cancelled", "Cancelled",
            "paid", "Payment Confirmed"
    );

    private static final Map<String, String> STATUS_COLORS = Map.of(
            "processing", "#f59e0b",
            "shipped", "#3b82f6",
            "completed", "#10b981",
            "cancelled", "#ef4444",
            "paid", "#10b981"
    );

    @RabbitListener(queues = "${application.messaging.queue.order-status-changed}")
    public void consume(OrderStatusChangedEvent event) {
        if (event == null || event.getCustomerEmail() == null || event.getCustomerEmail().isBlank()) {
            log.warn("Received null/incomplete order status changed event");
            return;
        }

        String newStatus = safe(event.getNewStatus()).toLowerCase();
        String label = STATUS_LABELS.getOrDefault(newStatus, capitalize(newStatus));
        String color = STATUS_COLORS.getOrDefault(newStatus, "#6b7280");

        String subject = "Order Update - " + safe(event.getOrderNumber()) + " is now " + label;

        String content = """
                <html>
                  <body style="font-family:Arial,sans-serif;color:#111;max-width:600px;margin:0 auto;">
                    <div style="background:linear-gradient(135deg,#1e3a5f,#2563eb);padding:24px;border-radius:12px 12px 0 0;">
                      <h2 style="color:#fff;margin:0;">Order Status Update</h2>
                    </div>
                    <div style="padding:24px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 12px 12px;">
                      <p>Hi %s,</p>
                      <p>Your order <strong>%s</strong> has been updated:</p>
                      <div style="text-align:center;margin:24px 0;">
                        <span style="display:inline-block;background:%s;color:#fff;padding:12px 32px;border-radius:8px;font-size:18px;font-weight:bold;">
                          %s
                        </span>
                      </div>
                      %s
                      <hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0;"/>
                      <p style="color:#6b7280;font-size:12px;">If you have any questions about your order, please contact our support team.</p>
                    </div>
                  </body>
                </html>
                """.formatted(
                esc(safe(event.getCustomerName()).isBlank() ? "Customer" : event.getCustomerName()),
                esc(event.getOrderNumber()),
                color,
                esc(label),
                getStatusMessage(newStatus)
        );

        emailService.sendEmail(event.getCustomerEmail(), subject, content);
        log.info("Order status change email sent to {} for order {}", event.getCustomerEmail(), event.getOrderNumber());

        // Send notification to admin if order is shipped
        if ("shipped".equals(newStatus) && StringUtils.hasText(adminEmail)) {
            String adminSubject = "Order Shipped - " + safe(event.getOrderNumber());
            String adminContent = """
                    <html>
                      <body style="font-family:Arial,sans-serif;color:#111;max-width:600px;margin:0 auto;">
                        <div style="background:linear-gradient(135deg,#1e3a5f,#2563eb);padding:24px;border-radius:12px 12px 0 0;">
                          <h2 style="color:#fff;margin:0;">Order Shipped Notification</h2>
                        </div>
                        <div style="padding:24px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 12px 12px;">
                          <p>Order <strong>%s</strong> has been shipped.</p>
                          <p>Customer: %s (%s)</p>
                          <p>Please monitor the delivery status.</p>
                        </div>
                      </body>
                    </html>
                    """.formatted(
                    esc(event.getOrderNumber()),
                    esc(safe(event.getCustomerName())),
                    esc(event.getCustomerEmail())
            );
            emailService.sendEmail(adminEmail, adminSubject, adminContent);
            log.info("Order shipped notification sent to admin for order {}", event.getOrderNumber());
        }
    }

    private String getStatusMessage(String status) {
        return switch (status) {
            case "shipped" -> "<p>🚚 Your order is on its way! You will receive a delivery notification soon.</p>";
            case "completed" -> "<p>✅ Your order has been delivered. We hope you enjoy your purchase!</p>";
            case "cancelled" -> "<p>❌ Your order has been cancelled. If you did not request this, please contact support.</p>";
            case "processing" -> "<p>⚙️ We're preparing your order. It will be shipped soon.</p>";
            case "paid" -> "<p>💳 Your payment has been confirmed. We'll start processing your order shortly.</p>";
            default -> "<p>Your order status has been updated.</p>";
        };
    }

    private String safe(String value) {
        return value == null ? "" : value.trim();
    }

    private String capitalize(String value) {
        String s = safe(value);
        return s.isEmpty() ? s : s.substring(0, 1).toUpperCase() + s.substring(1);
    }

    private String esc(String value) {
        return safe(value)
                .replace("&", "&amp;")
                .replace("<", "&lt;")
                .replace(">", "&gt;")
                .replace("\"", "&quot;")
                .replace("'", "&#39;");
    }
}
