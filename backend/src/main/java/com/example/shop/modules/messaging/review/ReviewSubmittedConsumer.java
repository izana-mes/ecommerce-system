package com.example.shop.modules.messaging.review;

import com.example.shop.common.mail.EmailService;
import com.example.shop.config.ConditionalOnRabbitEnabled;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
@ConditionalOnRabbitEnabled
@Slf4j
public class ReviewSubmittedConsumer {

    private final EmailService emailService;

    @Value("${application.bootstrap.admin.email:admin@example.com}")
    private String adminEmail;

    @RabbitListener(queues = "${application.messaging.queue.review-submitted}")
    public void consume(ReviewSubmittedEvent event) {
        if (event == null) {
            log.warn("Received null review submitted event");
            return;
        }

        log.info("Consumed review submitted event: product={} rating={}", event.getProductId(), event.getRating());

        // Send admin moderation notification
        String adminSubject = "📝 New Review - " + safe(event.getProductName());
        String ratingStars = "⭐".repeat(Math.max(1, Math.min(5, event.getRating())));
        String adminContent = """
                <html>
                  <body style="font-family:Arial,sans-serif;color:#111;max-width:600px;margin:0 auto;">
                    <div style="background:linear-gradient(135deg,#7c3aed,#a855f7);padding:24px;border-radius:12px 12px 0 0;">
                      <h2 style="color:#fff;margin:0;">📝 New Product Review</h2>
                    </div>
                    <div style="padding:24px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 12px 12px;">
                      <table style="width:100%%;border-collapse:collapse;">
                        <tr><td style="padding:8px;font-weight:bold;color:#6b7280;">Product</td><td style="padding:8px;">%s</td></tr>
                        <tr><td style="padding:8px;font-weight:bold;color:#6b7280;">Author</td><td style="padding:8px;">%s</td></tr>
                        <tr><td style="padding:8px;font-weight:bold;color:#6b7280;">Rating</td><td style="padding:8px;">%s (%d/5)</td></tr>
                        <tr><td style="padding:8px;font-weight:bold;color:#6b7280;">Comment</td><td style="padding:8px;">%s</td></tr>
                      </table>
                      <p style="color:#6b7280;font-size:12px;margin-top:16px;">Review submitted. Please moderate in the admin panel.</p>
                    </div>
                  </body>
                </html>
                """.formatted(
                esc(event.getProductName()),
                esc(event.getAuthor()),
                ratingStars,
                event.getRating(),
                esc(event.getComment())
        );

        emailService.sendEmail(adminEmail, adminSubject, adminContent);

        // Send thank-you email to customer if email is provided
        if (event.getCustomerEmail() != null && !event.getCustomerEmail().isBlank()) {
            String customerSubject = "Thank you for your review!";
            String customerContent = """
                    <html>
                      <body style="font-family:Arial,sans-serif;color:#111;max-width:600px;margin:0 auto;">
                        <div style="background:linear-gradient(135deg,#059669,#10b981);padding:24px;border-radius:12px 12px 0 0;">
                          <h2 style="color:#fff;margin:0;">Thank You! 🎉</h2>
                        </div>
                        <div style="padding:24px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 12px 12px;">
                          <p>Hi %s,</p>
                          <p>Thank you for reviewing <strong>%s</strong>. Your feedback helps other customers make informed decisions.</p>
                          <p>Your rating: %s</p>
                          <p style="color:#6b7280;font-size:12px;">Happy shopping!</p>
                        </div>
                      </body>
                    </html>
                    """.formatted(
                    esc(safe(event.getAuthor()).isBlank() ? "Customer" : event.getAuthor()),
                    esc(event.getProductName()),
                    ratingStars
            );
            emailService.sendEmail(event.getCustomerEmail(), customerSubject, customerContent);
        }
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
}
