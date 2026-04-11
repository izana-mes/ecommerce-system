package com.example.shop.modules.notification.service;

import com.example.shop.common.mail.EmailService;
import com.example.shop.modules.messaging.order.OrderCreatedEvent;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.util.Locale;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class OrderCreatedNotificationService {

    private final EmailService emailService;

    public void sendOrderReceivedEmail(OrderCreatedEvent event) {
        String to = safe(event.getCustomerEmail());
        if (to.isBlank()) {
            log.warn("No customer email for order {}, skipping notification", event.getOrderNumber());
            return;
        }

        String orderNumber = safe(event.getOrderNumber());
        String currency = safe(event.getCurrency()).isBlank() ? "USD" : safe(event.getCurrency()).toUpperCase(Locale.ROOT);
        String customerName = joinNonBlank(event.getCustomerFirstName(), event.getCustomerLastName());
        String subject = "Order Received - " + orderNumber;

        String itemsHtml = event.getItems() == null || event.getItems().isEmpty()
                ? "<tr><td colspan=\"4\" style=\"padding:8px;border:1px solid #ddd;\">No items</td></tr>"
                : event.getItems().stream()
                .map(item -> "<tr>"
                        + "<td style=\"padding:8px;border:1px solid #ddd;\">" + esc(item.getProductName()) + "</td>"
                        + "<td style=\"padding:8px;border:1px solid #ddd;text-align:center;\">" + item.getQuantity() + "</td>"
                        + "<td style=\"padding:8px;border:1px solid #ddd;text-align:right;\">" + esc(money(item.getUnitPrice(), currency)) + "</td>"
                        + "<td style=\"padding:8px;border:1px solid #ddd;text-align:right;\">" + esc(money(item.getLineTotal(), currency)) + "</td>"
                        + "</tr>")
                .collect(Collectors.joining());

        String content = """
                <html>
                  <body style="font-family:Arial,sans-serif;color:#111;">
                    <h2 style="color:#2563eb;">Order Received!</h2>
                    <p>Hi %s,</p>
                    <p>We've received your order <strong>%s</strong> and it's being processed.</p>
                    <h3>Order Summary</h3>
                    <table style="border-collapse:collapse;width:100%%;">
                      <thead>
                        <tr style="background:#f3f4f6;">
                          <th style="padding:8px;border:1px solid #ddd;text-align:left;">Product</th>
                          <th style="padding:8px;border:1px solid #ddd;text-align:center;">Qty</th>
                          <th style="padding:8px;border:1px solid #ddd;text-align:right;">Unit Price</th>
                          <th style="padding:8px;border:1px solid #ddd;text-align:right;">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        %s
                      </tbody>
                    </table>
                    <h3>Totals</h3>
                    <p><strong>Subtotal:</strong> %s</p>
                    <p><strong>Shipping:</strong> %s</p>
                    <p><strong>VAT:</strong> %s</p>
                    <p><strong>Total:</strong> %s</p>
                    <p><strong>Payment Method:</strong> %s</p>
                    <hr/>
                    <p style="color:#6b7280;font-size:12px;">You will receive another email once your payment is confirmed.</p>
                  </body>
                </html>
                """.formatted(
                esc(customerName.isBlank() ? "Customer" : customerName),
                esc(orderNumber),
                itemsHtml,
                esc(money(event.getSubtotal(), currency)),
                esc(money(event.getShippingFee(), currency)),
                esc(money(event.getVat(), currency)),
                esc(money(event.getTotalAmount(), currency)),
                esc(safe(event.getPaymentMethod()))
        );

        emailService.sendEmail(to, subject, content);
        log.info("Order received email sent to {} for order {}", to, orderNumber);
    }

    private String money(BigDecimal amount, String currency) {
        double value = amount == null ? 0D : amount.doubleValue();
        return "%s %,.2f".formatted(currency, value);
    }

    private String joinNonBlank(String... values) {
        if (values == null) return "";
        StringBuilder sb = new StringBuilder();
        for (String v : values) {
            String s = safe(v);
            if (!s.isBlank()) {
                if (!sb.isEmpty()) sb.append(" ");
                sb.append(s);
            }
        }
        return sb.toString();
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
