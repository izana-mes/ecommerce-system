package com.example.shop.modules.notification.service;

import com.example.shop.common.mail.EmailService;
import com.example.shop.modules.notification.dto.OrderPaidEmailRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.Arrays;
import java.util.List;
import java.util.Locale;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class OrderNotificationService {

    private final EmailService emailService;

    public void sendOrderPaidEmail(OrderPaidEmailRequest request) {
        String to = safe(request.getTo());
        if (to.isBlank()) {
            throw new IllegalArgumentException("Missing recipient email");
        }

        String orderNumber = safe(request.getOrderNumber());
        String currency = safe(request.getCurrency()).isBlank() ? "USD" : safe(request.getCurrency()).toUpperCase(Locale.ROOT);
        String customerName = joinNonBlank(request.getCustomerFirstName(), request.getCustomerLastName());
        String shippingAddress = joinNonBlank(
                request.getShippingAddressLine1(),
                request.getShippingAddressLine2(),
                request.getShippingCity(),
                request.getShippingState(),
                request.getShippingPostalCode(),
                request.getShippingCountry()
        );
        String subject = "Payment Successful - Order " + orderNumber;

        String itemsHtml = request.getItems() == null || request.getItems().isEmpty()
                ? "<tr><td colspan=\"4\" style=\"padding:8px;border:1px solid #ddd;\">No items</td></tr>"
                : request.getItems().stream()
                .map(item -> "<tr>"
                        + "<td style=\"padding:8px;border:1px solid #ddd;\">" + esc(item.getProductID()) + "</td>"
                        + "<td style=\"padding:8px;border:1px solid #ddd;\">" + esc(item.getProductName()) + "</td>"
                        + "<td style=\"padding:8px;border:1px solid #ddd;text-align:center;\">" + item.getQuantity() + "</td>"
                        + "<td style=\"padding:8px;border:1px solid #ddd;text-align:right;\">" + esc(money(item.getLineTotal(), currency)) + "</td>"
                        + "</tr>")
                .collect(Collectors.joining());

        String content = """
                <html>
                  <body style="font-family:Arial,sans-serif;color:#111;">
                    <h2>Payment Successful</h2>
                    <p>Your payment for order <strong>%s</strong> was successful.</p>
                    <h3>Customer Information</h3>
                    <p><strong>Name:</strong> %s</p>
                    <p><strong>Email:</strong> %s</p>
                    <p><strong>Phone:</strong> %s</p>
                    <h3>Shipping Information</h3>
                    <p><strong>Address:</strong> %s</p>
                    <h3>Order Items</h3>
                    <table style="border-collapse:collapse;width:100%%;">
                      <thead>
                        <tr>
                          <th style="padding:8px;border:1px solid #ddd;text-align:left;">Product ID</th>
                          <th style="padding:8px;border:1px solid #ddd;text-align:left;">Product Name</th>
                          <th style="padding:8px;border:1px solid #ddd;text-align:center;">Qty</th>
                          <th style="padding:8px;border:1px solid #ddd;text-align:right;">Line Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        %s
                      </tbody>
                    </table>
                    <h3>Payment Summary</h3>
                    <p><strong>Payment Method:</strong> %s</p>
                    <p><strong>Subtotal:</strong> %s</p>
                    <p><strong>Shipping Fee:</strong> %s</p>
                    <p><strong>VAT:</strong> %s</p>
                    <p><strong>Total:</strong> %s</p>
                    <p><strong>Notes:</strong> %s</p>
                  </body>
                </html>
                """.formatted(
                esc(orderNumber),
                esc(customerName),
                esc(safe(request.getCustomerEmail())),
                esc(safe(request.getCustomerPhone())),
                esc(shippingAddress),
                itemsHtml,
                esc(safe(request.getPaymentMethod())),
                esc(money(request.getSubtotal(), currency)),
                esc(money(request.getShippingFee(), currency)),
                esc(money(request.getVat(), currency)),
                esc(money(request.getTotalAmount(), currency)),
                esc(safe(request.getNotes()))
        );

        emailService.sendEmail(to, subject, content);
    }

    private String money(double amount, String currency) {
        return "%s %,.2f".formatted(currency, amount);
    }

    private String joinNonBlank(String... values) {
        if (values == null || values.length == 0) {
            return "";
        }
        return Arrays.stream(values)
                .map(this::safe)
                .filter(v -> !v.isBlank())
                .collect(Collectors.joining(", "));
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
