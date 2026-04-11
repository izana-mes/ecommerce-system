package com.example.shop.modules.messaging.inventory;

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
public class LowStockAlertConsumer {

    private final EmailService emailService;

    @Value("${application.bootstrap.admin.email:admin@example.com}")
    private String adminEmail;

    @RabbitListener(queues = "${application.messaging.queue.low-stock-alert}")
    public void consume(LowStockAlertEvent event) {
        if (event == null) {
            log.warn("Received null low stock alert event");
            return;
        }

        log.warn("Low stock detected: product={} name={} remaining={}",
                event.getProductId(), event.getProductName(), event.getRemainingStock());

        String subject = "⚠️ Low Stock Alert - " + event.getProductName();
        String content = """
                <html>
                  <body style="font-family:Arial,sans-serif;color:#111;">
                    <h2 style="color:#dc2626;">⚠️ Low Stock Alert</h2>
                    <p>The following product is running low on inventory:</p>
                    <table style="border-collapse:collapse;width:100%%;">
                      <tr>
                        <td style="padding:8px;border:1px solid #ddd;font-weight:bold;">Product ID</td>
                        <td style="padding:8px;border:1px solid #ddd;">%s</td>
                      </tr>
                      <tr>
                        <td style="padding:8px;border:1px solid #ddd;font-weight:bold;">Product Name</td>
                        <td style="padding:8px;border:1px solid #ddd;">%s</td>
                      </tr>
                      <tr>
                        <td style="padding:8px;border:1px solid #ddd;font-weight:bold;">Remaining Stock</td>
                        <td style="padding:8px;border:1px solid #ddd;color:#dc2626;font-weight:bold;">%d units</td>
                      </tr>
                      <tr>
                        <td style="padding:8px;border:1px solid #ddd;font-weight:bold;">Triggered by Order</td>
                        <td style="padding:8px;border:1px solid #ddd;">%s</td>
                      </tr>
                    </table>
                    <p style="margin-top:16px;">Please restock this product as soon as possible.</p>
                  </body>
                </html>
                """.formatted(
                esc(event.getProductId()),
                esc(event.getProductName()),
                event.getRemainingStock(),
                esc(event.getOrderNumber())
        );

        emailService.sendEmail(adminEmail, subject, content);
        log.info("Low stock alert email sent to admin for product {}", event.getProductId());
    }

    private String esc(String value) {
        if (value == null) return "";
        return value.replace("&", "&amp;")
                .replace("<", "&lt;")
                .replace(">", "&gt;")
                .replace("\"", "&quot;")
                .replace("'", "&#39;");
    }
}
