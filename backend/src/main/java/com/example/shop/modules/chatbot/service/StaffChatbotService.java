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

/**
 * Staff/admin chatbot service — answers operational questions using live DB data.
 * Handles low-stock alerts, top-selling products, revenue summaries, order lookup, and catalog search.
 * Uses JdbcTemplate so it runs on the backend (no serverless DB connection issues).
 */
@Service
@RequiredArgsConstructor
public class StaffChatbotService {

    private final JdbcTemplate jdbcTemplate;

    private static final Pattern ORDER_NUMBER_PATTERN =
            Pattern.compile("\\b([A-Z]{2,}[A-Z0-9_\\-]{2,})\\b", Pattern.CASE_INSENSITIVE);
    private static final Pattern EMAIL_PATTERN =
            Pattern.compile("\\b[A-Z0-9._%+\\-]+@[A-Z0-9.\\-]+\\.[A-Z]{2,}\\b", Pattern.CASE_INSENSITIVE);

    public record ChatResult(String intent, String answer) {}

    // -------------------------------------------------------------------------
    // Public API
    // -------------------------------------------------------------------------

    public ChatResult buildAnswer(String question) {
        String normalized = question.trim().replaceAll("\\s+", " ");

        if (isLowStockIntent(normalized)) return resolveLowStock();
        if (isTopSellingIntent(normalized)) return resolveTopSelling();
        if (isRevenueIntent(normalized)) return resolveRevenue();

        String orderNumber = extractOrderNumber(normalized);
        String email = extractEmail(normalized);
        if (orderNumber != null || email != null) {
            return resolveOrderLookup(orderNumber, email);
        }

        if (isCatalogIntent(normalized)) return resolveCatalog(normalized);

        return resolveDefault();
    }

    // -------------------------------------------------------------------------
    // Intent detection
    // -------------------------------------------------------------------------

    private boolean isLowStockIntent(String q) {
        String lower = q.toLowerCase();
        return lower.contains("low stock") || lower.contains("out of stock")
                || lower.contains("inventory alert") || lower.contains("stock alert")
                || lower.contains("stock level");
    }

    private boolean isTopSellingIntent(String q) {
        String lower = q.toLowerCase();
        return lower.contains("top selling") || lower.contains("best selling")
                || lower.contains("best seller") || lower.contains("most sold")
                || lower.contains("top products");
    }

    private boolean isRevenueIntent(String q) {
        String lower = q.toLowerCase();
        return lower.contains("revenue") || lower.contains("sales total")
                || lower.contains("gmv") || lower.contains("income")
                || lower.contains("how much") || lower.contains("earning");
    }

    private boolean isCatalogIntent(String q) {
        return q.matches("(?i).*\\b(price|product|catalog|stock|available|size|material|color|show|find|inventory)\\b.*");
    }

    // -------------------------------------------------------------------------
    // Low stock
    // -------------------------------------------------------------------------

    private ChatResult resolveLowStock() {
        List<Map<String, Object>> rows = jdbcTemplate.queryForList(
                """
                SELECT product_id, product_name, stock_quantity
                FROM products
                WHERE active = TRUE
                ORDER BY stock_quantity ASC, product_id ASC
                LIMIT 10
                """
        );

        if (rows.isEmpty()) {
            return new ChatResult("low_stock", "No active products found in the catalog.");
        }

        List<Map<String, Object>> critical = new ArrayList<>();
        for (Map<String, Object> row : rows) {
            Number qty = (Number) row.get("stock_quantity");
            if (qty != null && qty.intValue() <= 5) critical.add(row);
        }

        List<Map<String, Object>> toShow = critical.isEmpty() ? rows.subList(0, Math.min(5, rows.size())) : critical;
        StringJoiner joiner = new StringJoiner(" | ");
        for (Map<String, Object> row : toShow) {
            joiner.add(String.format("%s (%s) → stock %s",
                    row.get("product_name"), row.get("product_id"), row.get("stock_quantity")));
        }

        String prefix = critical.isEmpty()
                ? "No critical low-stock items. Lowest stock products: "
                : String.format("%d critical low-stock product(s): ", critical.size());
        return new ChatResult("low_stock", prefix + joiner);
    }

    // -------------------------------------------------------------------------
    // Top selling
    // -------------------------------------------------------------------------

    private ChatResult resolveTopSelling() {
        List<Map<String, Object>> rows = jdbcTemplate.queryForList(
                """
                SELECT product_id, product_name, SUM(quantity) AS sold_qty, SUM(line_total) AS revenue
                FROM order_items
                GROUP BY product_id, product_name
                ORDER BY sold_qty DESC
                LIMIT 5
                """
        );

        if (rows.isEmpty()) {
            return new ChatResult("top_selling", "No order item data is available yet.");
        }

        StringJoiner joiner = new StringJoiner(" | ");
        for (Map<String, Object> row : rows) {
            joiner.add(String.format("%s (%s) sold %s",
                    row.get("product_name"), row.get("product_id"), row.get("sold_qty")));
        }
        return new ChatResult("top_selling", "Top selling products: " + joiner);
    }

    // -------------------------------------------------------------------------
    // Revenue
    // -------------------------------------------------------------------------

    private ChatResult resolveRevenue() {
        List<Map<String, Object>> rows = jdbcTemplate.queryForList(
                """
                SELECT
                  COUNT(*) AS total_orders,
                  COALESCE(SUM(total_amount), 0) AS total_revenue,
                  SUM(CASE WHEN LOWER(payment_status) = 'paid' THEN 1 ELSE 0 END) AS paid_orders
                FROM orders
                WHERE created_at >= NOW() - INTERVAL '30 days'
                """
        );

        if (rows.isEmpty()) {
            return new ChatResult("revenue", "No order data available.");
        }

        Map<String, Object> row = rows.get(0);
        Number totalOrders = (Number) row.getOrDefault("total_orders", 0);
        Number paidOrders  = (Number) row.getOrDefault("paid_orders", 0);
        Number revenue     = (Number) row.getOrDefault("total_revenue", 0);

        return new ChatResult("revenue", String.format(
                "Last 30 days: %s total orders, %s paid, total revenue %s.",
                totalOrders, paidOrders, formatMoney(revenue, "USD")
        ));
    }

    // -------------------------------------------------------------------------
    // Order lookup
    // -------------------------------------------------------------------------

    private ChatResult resolveOrderLookup(String orderNumber, String email) {
        if (orderNumber != null) {
            List<Map<String, Object>> rows = jdbcTemplate.queryForList(
                    """
                    SELECT order_number, customer_email, order_status, payment_status,
                           total_amount, currency, created_at
                    FROM orders
                    WHERE UPPER(order_number) = UPPER(?)
                    ORDER BY created_at DESC
                    LIMIT 1
                    """,
                    orderNumber
            );

            if (!rows.isEmpty()) {
                Map<String, Object> order = rows.get(0);
                return new ChatResult("order_lookup", String.format(
                        "Order %s is %s with payment %s. Total: %s, created at %s for %s.",
                        order.get("order_number"), order.get("order_status"), order.get("payment_status"),
                        formatMoney(order.get("total_amount"), String.valueOf(order.getOrDefault("currency", "USD"))),
                        formatDate(order.get("created_at")), order.get("customer_email")
                ));
            }
        }

        if (email != null) {
            List<Map<String, Object>> rows = jdbcTemplate.queryForList(
                    """
                    SELECT order_number, order_status, payment_status, total_amount, currency, created_at
                    FROM orders
                    WHERE LOWER(customer_email) = LOWER(?)
                    ORDER BY created_at DESC
                    LIMIT 5
                    """,
                    email
            );

            if (rows.isEmpty()) {
                return new ChatResult("customer_orders", "No orders found for " + email + ".");
            }

            StringJoiner joiner = new StringJoiner(" | ");
            for (Map<String, Object> row : rows) {
                joiner.add(String.format("%s: %s/%s, %s, %s",
                        row.get("order_number"), row.get("order_status"), row.get("payment_status"),
                        formatMoney(row.get("total_amount"), String.valueOf(row.getOrDefault("currency", "USD"))),
                        formatDate(row.get("created_at"))));
            }
            return new ChatResult("customer_orders", "Orders for " + email + ": " + joiner);
        }

        return new ChatResult("order_help", "Provide an order number or customer email to look up orders.");
    }

    // -------------------------------------------------------------------------
    // Catalog search
    // -------------------------------------------------------------------------

    private ChatResult resolveCatalog(String question) {
        String keyword = question.toLowerCase()
                .replaceAll("[^a-z0-9\\s]", " ")
                .replaceAll("\\b(price|product|catalog|stock|available|show|find|details|about|the|a|an|for|of|inventory)\\b", " ")
                .replaceAll("\\s+", " ")
                .trim();

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
            return new ChatResult("catalog_not_found", "No matching products found. Try a shorter keyword.");
        }

        StringJoiner joiner = new StringJoiner(" | ");
        for (Map<String, Object> row : rows) {
            joiner.add(String.format("%s (%s) — %s, stock %s",
                    row.get("product_name"), row.get("product_id"),
                    formatMoney(row.get("product_price"), "USD"), row.get("stock_quantity")));
        }
        return new ChatResult("catalog_lookup", "Matching products: " + joiner);
    }

    // -------------------------------------------------------------------------
    // Default / summary
    // -------------------------------------------------------------------------

    private ChatResult resolveDefault() {
        Integer totalProducts = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM products WHERE active = TRUE", Integer.class);
        Integer pendingOrders = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM orders WHERE LOWER(order_status) = 'pending'", Integer.class);

        return new ChatResult("summary", String.format(
                "Live summary: %d active products, %d pending orders. " +
                "Ask about low stock, top selling, revenue, a specific order number, customer email, or product prices.",
                totalProducts == null ? 0 : totalProducts,
                pendingOrders == null ? 0 : pendingOrders
        ));
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

    private String formatMoney(Object value, String currency) {
        try {
            double amount = Double.parseDouble(String.valueOf(value));
            Currency curr = Currency.getInstance(currency == null || currency.isBlank() ? "USD" : currency.trim().toUpperCase());
            NumberFormat fmt = NumberFormat.getCurrencyInstance(Locale.US);
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
