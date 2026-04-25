package com.example.shop.modules.chatbot.service;

import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.text.NumberFormat;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Service
@RequiredArgsConstructor
public class ChatbotService {

    private final JdbcTemplate jdbcTemplate;

    private static final Pattern ORDER_NUMBER_PATTERN =
            Pattern.compile("\\b([A-Z]{2,}[A-Z0-9_\\-]{2,})\\b", Pattern.CASE_INSENSITIVE);
    private static final Pattern EMAIL_PATTERN =
            Pattern.compile("\\b[A-Z0-9._%+\\-]+@[A-Z0-9.\\-]+\\.[A-Z]{2,}\\b", Pattern.CASE_INSENSITIVE);

    // -------------------------------------------------------------------------
    // Public API
    // -------------------------------------------------------------------------

    public record ChatResult(String intent, String answer) {}

    public ChatResult buildAnswer(String question, String currentUserEmail) {
        String normalized = question.trim().replaceAll("\\s+", " ");

        if (isPolicyIntent(normalized)) {
            return resolvePolicyAnswer(normalized);
        }
        if (isOrderIntent(normalized)) {
            return resolveOrderAnswer(normalized, currentUserEmail);
        }
        if (isCatalogIntent(normalized)) {
            return resolveCatalogAnswer(normalized);
        }
        return resolveFallback();
    }

    // -------------------------------------------------------------------------
    // Intent detection
    // -------------------------------------------------------------------------

    private boolean isPolicyIntent(String q) {
        return q.matches("(?i).*\\b(shipping|delivery|return|refund|exchange|support|contact|payment method|cash on delivery|cod)\\b.*");
    }

    private boolean isOrderIntent(String q) {
        return q.matches("(?i).*\\b(order|status|tracking|payment|my order)\\b.*");
    }

    private boolean isCatalogIntent(String q) {
        return q.matches("(?i).*\\b(price|product|catalog|stock|available|size|material|color|show|find)\\b.*");
    }

    // -------------------------------------------------------------------------
    // Policy (no DB)
    // -------------------------------------------------------------------------

    private ChatResult resolvePolicyAnswer(String question) {
        String lower = question.toLowerCase();
        if (lower.contains("return") || lower.contains("refund") || lower.contains("exchange")) {
            return new ChatResult("policy_returns",
                    "Return policy: eligible items can be returned within 30 days in original condition. " +
                    "For refunds, include your order number and contact support from the Contact page.");
        }
        if (lower.contains("shipping") || lower.contains("delivery")) {
            return new ChatResult("policy_shipping",
                    "Shipping info: standard delivery times vary by destination. " +
                    "You can track shipment status from your order details once the order is dispatched.");
        }
        if (lower.contains("payment") || lower.contains("cod") || lower.contains("cash on delivery")) {
            return new ChatResult("policy_payment",
                    "Supported payment methods include online payment options shown at checkout. " +
                    "Payment status updates appear in your order status after processing.");
        }
        return new ChatResult("policy_general",
                "For support questions, share your order number and issue details. " +
                "You can also use the Contact page for direct assistance.");
    }

    // -------------------------------------------------------------------------
    // Order lookup
    // -------------------------------------------------------------------------

    private ChatResult resolveOrderAnswer(String question, String currentUserEmail) {
        String orderNumber = extractOrderNumber(question);
        String providedEmail = extractEmail(question);

        if (orderNumber == null) {
            return new ChatResult("order_help",
                    "To check order status, provide your order number (e.g. ORD-12345). " +
                    "If you are not logged in, also include the order email.");
        }

        String lookupEmail = (currentUserEmail != null && !currentUserEmail.isBlank())
                ? currentUserEmail : providedEmail;

        if (lookupEmail == null) {
            return new ChatResult("order_help",
                    "For privacy, please log in first or include the order email with your order number " +
                    "(example: ORD-1001 and name@email.com).");
        }

        List<Map<String, Object>> rows = jdbcTemplate.queryForList(
                """
                SELECT order_number, order_status, payment_status, total_amount, currency, created_at
                FROM orders
                WHERE UPPER(order_number) = UPPER(?)
                  AND LOWER(customer_email) = LOWER(?)
                ORDER BY created_at DESC
                LIMIT 1
                """,
                orderNumber, lookupEmail
        );

        if (rows.isEmpty()) {
            return new ChatResult("order_not_found",
                    "I couldn't find an order with that order number and email combination.");
        }

        Map<String, Object> order = rows.get(0);
        String answer = String.format(
                "Order %s is %s and payment is %s. Total: %s. Created at %s.",
                order.get("order_number"),
                order.get("order_status"),
                order.get("payment_status"),
                formatMoney(order.get("total_amount"), String.valueOf(order.getOrDefault("currency", "USD"))),
                formatDate(order.get("created_at"))
        );
        return new ChatResult("order_status", answer);
    }

    // -------------------------------------------------------------------------
    // Catalog search
    // -------------------------------------------------------------------------

    private ChatResult resolveCatalogAnswer(String question) {
        String keyword = extractCatalogKeyword(question);

        List<Map<String, Object>> rows = jdbcTemplate.queryForList(
                """
                SELECT product_id, product_name, product_price, stock_quantity
                FROM products
                WHERE active = TRUE
                  AND LOWER(product_name) LIKE LOWER(?)
                ORDER BY stock_quantity DESC
                LIMIT 5
                """,
                "%" + (keyword.isBlank() ? question : keyword) + "%"
        );

        if (rows.isEmpty()) {
            return new ChatResult("catalog_not_found",
                    "I couldn't find matching products. Try a shorter product name keyword.");
        }

        StringJoiner joiner = new StringJoiner(" | ");
        for (Map<String, Object> row : rows) {
            joiner.add(String.format("%s (%s) - %s, stock %s",
                    row.get("product_name"),
                    row.get("product_id"),
                    formatMoney(row.get("product_price"), "USD"),
                    row.get("stock_quantity")));
        }
        return new ChatResult("catalog_lookup", "Here are matching products: " + joiner);
    }

    // -------------------------------------------------------------------------
    // Fallback
    // -------------------------------------------------------------------------

    private ChatResult resolveFallback() {
        Integer total = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM products WHERE active = TRUE", Integer.class);
        int count = total == null ? 0 : total;
        return new ChatResult("fallback",
                "I can help with product questions, stock and prices, shipping/returns, and order status. " +
                "Current catalog has " + count + " active products.");
    }

    // -------------------------------------------------------------------------
    // Helpers
    // -------------------------------------------------------------------------

    private String extractOrderNumber(String question) {
        Matcher m = ORDER_NUMBER_PATTERN.matcher(question);
        return m.find() ? m.group(1).toUpperCase() : null;
    }

    private String extractEmail(String question) {
        Matcher m = EMAIL_PATTERN.matcher(question);
        return m.find() ? m.group(0).toLowerCase() : null;
    }

    private String extractCatalogKeyword(String question) {
        return question.toLowerCase()
                .replaceAll("[^a-z0-9\\s]", " ")
                .replaceAll("\\b(price|product|catalog|stock|available|show|find|details|about|the|a|an|for|of)\\b", " ")
                .replaceAll("\\s+", " ")
                .trim();
    }

    private String formatMoney(Object value, String currency) {
        try {
            double amount = Double.parseDouble(String.valueOf(value));
            Locale locale = Locale.US;
            Currency curr = Currency.getInstance(currency == null || currency.isBlank() ? "USD" : currency.trim().toUpperCase());
            NumberFormat fmt = NumberFormat.getCurrencyInstance(locale);
            fmt.setCurrency(curr);
            fmt.setMaximumFractionDigits(2);
            return fmt.format(amount);
        } catch (Exception e) {
            return String.valueOf(value);
        }
    }

    private String formatDate(Object value) {
        if (value == null) return "-";
        try {
            if (value instanceof LocalDateTime ldt) {
                return ldt.format(DateTimeFormatter.ISO_LOCAL_DATE_TIME);
            }
            if (value instanceof java.sql.Timestamp ts) {
                return ts.toLocalDateTime().format(DateTimeFormatter.ISO_LOCAL_DATE_TIME);
            }
            return Instant.parse(value.toString())
                    .atOffset(ZoneOffset.UTC)
                    .format(DateTimeFormatter.ISO_OFFSET_DATE_TIME);
        } catch (Exception e) {
            return String.valueOf(value);
        }
    }
}
