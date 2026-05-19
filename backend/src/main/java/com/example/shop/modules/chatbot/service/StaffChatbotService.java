package com.example.shop.modules.chatbot.service;

import com.example.shop.modules.admin.dto.AdminDashboardResponse;
import com.example.shop.modules.admin.service.AdminDashboardService;
import com.example.shop.modules.order.dto.OrderHistoryItemDto;
import com.example.shop.modules.order.service.OrderService;
import com.example.shop.modules.product.dto.ProductDto;
import com.example.shop.modules.product.service.ProductService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.text.NumberFormat;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Staff/admin chatbot service — answers operational questions using the application service layer.
 * All database access is delegated to ProductService, OrderService, and AdminDashboardService.
 * This avoids direct JdbcTemplate usage and benefits from existing caching and authorization logic.
 */
@Service
@RequiredArgsConstructor
public class StaffChatbotService {

    private final ProductService productService;
    private final OrderService orderService;
    private final AdminDashboardService adminDashboardService;
    private final ChatbotAiClient chatbotAiClient;

    private static final Pattern ORDER_NUMBER_PATTERN =
            Pattern.compile("\\b([A-Z]{2,}[A-Z0-9_\\-]{2,})\\b", Pattern.CASE_INSENSITIVE);
    private static final Pattern EMAIL_PATTERN =
            Pattern.compile("\\b[A-Z0-9._%+\\-]+@[A-Z0-9.\\-]+\\.[A-Z]{2,}\\b", Pattern.CASE_INSENSITIVE);

    private static final int DASHBOARD_DAYS = 30;
    private static final int DASHBOARD_RECENT_LIMIT = 5;
    private static final int LOW_STOCK_THRESHOLD = 5;

    public record ChatResult(String intent, String answer) {}

    // -------------------------------------------------------------------------
    // Public API
    // -------------------------------------------------------------------------

    public ChatResult buildAnswer(String question) {
        String normalized = question.trim().replaceAll("\\s+", " ");
        ChatResult deterministic = null;
        if (isLowStockIntent(normalized)) {
            deterministic = resolveLowStock();
        } else if (isTopSellingIntent(normalized)) {
            deterministic = resolveTopSelling();
        } else if (isRevenueIntent(normalized)) {
            deterministic = resolveRevenue();
        }

        if (deterministic == null) {
            String orderNumber = extractOrderNumber(normalized);
            String email = extractEmail(normalized);
            if (orderNumber != null || email != null) {
                deterministic = resolveOrderLookup(orderNumber, email);
            } else if (isCatalogIntent(normalized)) {
                deterministic = resolveCatalog(normalized);
            } else {
                deterministic = resolveDefault();
            }
        }

        String context = "Staff operations assistant context for ecommerce admin.";
        List<String> recentMessages = List.of("user: " + normalized, "assistant: " + deterministic.answer());
        Optional<String> aiAnswer = chatbotAiClient.generateStaffAnswer(normalized, context, recentMessages);
        String finalAnswer = aiAnswer.filter(v -> !v.isBlank()).orElse(deterministic.answer());
        return new ChatResult(deterministic.intent(), finalAnswer);

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
    // Low stock — via ProductService.getInventoryHealth()
    // -------------------------------------------------------------------------

    private ChatResult resolveLowStock() {
        @SuppressWarnings("unchecked")
        Map<String, Object> health = productService.getInventoryHealth(LOW_STOCK_THRESHOLD);

        @SuppressWarnings("unchecked")
        List<Map<String, Object>> criticalItems = (List<Map<String, Object>>) health.getOrDefault("lowStockItems", List.of());
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> outOfStockItems = (List<Map<String, Object>>) health.getOrDefault("outOfStockItems", List.of());

        if (criticalItems.isEmpty() && outOfStockItems.isEmpty()) {
            int activeProducts = toInt(health.getOrDefault("activeProducts", 0));
            return new ChatResult("low_stock",
                    "No low-stock or out-of-stock products. All " + activeProducts + " active products are adequately stocked.");
        }

        StringJoiner joiner = new StringJoiner(" | ");
        for (Map<String, Object> item : outOfStockItems) {
            joiner.add(String.format("%s (%s) → OUT OF STOCK",
                    item.get("productName"), item.get("productID")));
        }
        for (Map<String, Object> item : criticalItems) {
            joiner.add(String.format("%s (%s) → stock %s, available %s",
                    item.get("productName"), item.get("productID"),
                    item.get("stockQuantity"), item.get("availableToSell")));
        }

        String prefix = String.format("%d out-of-stock, %d low-stock product(s): ",
                outOfStockItems.size(), criticalItems.size());
        return new ChatResult("low_stock", prefix + joiner);
    }

    // -------------------------------------------------------------------------
    // Top selling — via AdminDashboardService
    // -------------------------------------------------------------------------

    private ChatResult resolveTopSelling() {
        AdminDashboardResponse dashboard = adminDashboardService.getDashboard(
                DASHBOARD_DAYS, DASHBOARD_RECENT_LIMIT, LOW_STOCK_THRESHOLD);

        List<AdminDashboardResponse.SoldProductPoint> topSold = dashboard.topSoldProducts();
        if (topSold == null || topSold.isEmpty()) {
            return new ChatResult("top_selling", "No order item data is available yet.");
        }

        StringJoiner joiner = new StringJoiner(" | ");
        for (AdminDashboardResponse.SoldProductPoint p : topSold) {
            joiner.add(String.format("%s (%s) sold %d",
                    p.productName(), p.productID(), p.soldQty()));
        }
        return new ChatResult("top_selling", "Top selling products: " + joiner);
    }

    // -------------------------------------------------------------------------
    // Revenue — via AdminDashboardService
    // -------------------------------------------------------------------------

    private ChatResult resolveRevenue() {
        AdminDashboardResponse dashboard = adminDashboardService.getDashboard(
                DASHBOARD_DAYS, DASHBOARD_RECENT_LIMIT, LOW_STOCK_THRESHOLD);

        long totalOrders = dashboard.totalOrders();
        BigDecimal totalRevenue = dashboard.totalRevenue() == null ? BigDecimal.ZERO : dashboard.totalRevenue();
        long pendingOrders = dashboard.pendingOrders();

        return new ChatResult("revenue", String.format(
                "Overall: %d total orders, %d pending, total revenue %s (all time paid orders).",
                totalOrders, pendingOrders, formatMoney(totalRevenue, "USD")
        ));
    }

    // -------------------------------------------------------------------------
    // Order lookup — via OrderService (service layer, no raw SQL in chatbot)
    // -------------------------------------------------------------------------

    private ChatResult resolveOrderLookup(String orderNumber, String email) {
        if (orderNumber != null) {
            Optional<OrderHistoryItemDto> order = orderService.findOrderByNumberForAdmin(orderNumber);
            if (order.isPresent()) {
                return new ChatResult("order_lookup", formatOrderSummaryForStaff(order.get()));
            }
        }

        if (email != null) {
            List<OrderHistoryItemDto> orders = orderService.findOrdersByEmailForAdmin(email, 5);
            if (orders.isEmpty()) {
                return new ChatResult("customer_orders", "No orders found for " + email + ".");
            }
            StringJoiner joiner = new StringJoiner(" | ");
            for (OrderHistoryItemDto o : orders) {
                joiner.add(String.format("%s: %s/%s, %s, %s",
                        o.getOrderNumber(), o.getOrderStatus(), o.getPaymentStatus(),
                        formatMoney(o.getTotalAmount(), o.getCurrency()),
                        o.getCreatedAt() != null ? o.getCreatedAt().format(DateTimeFormatter.ISO_LOCAL_DATE) : "-"));
            }
            return new ChatResult("customer_orders", "Orders for " + email + ": " + joiner);
        }

        return new ChatResult("order_help", "Provide an order number or customer email to look up orders.");
    }

    // -------------------------------------------------------------------------
    // Catalog search — via ProductService
    // -------------------------------------------------------------------------

    private ChatResult resolveCatalog(String question) {
        String keyword = question.toLowerCase()
                .replaceAll("[^a-z0-9\\s]", " ")
                .replaceAll("\\b(price|product|catalog|stock|available|show|find|details|about|the|a|an|for|of|inventory)\\b", " ")
                .replaceAll("\\s+", " ")
                .trim();

        List<ProductDto> results = productService.searchProducts(keyword.isBlank() ? question : keyword);

        if (results.isEmpty()) {
            return new ChatResult("catalog_not_found", "No matching products found. Try a shorter keyword.");
        }

        List<ProductDto> limited = results.stream().limit(5).toList();
        StringJoiner joiner = new StringJoiner(" | ");
        for (ProductDto p : limited) {
            joiner.add(String.format("%s (%s) — %s, stock %d",
                    p.getProductName(), p.getProductID(),
                    formatMoney(p.getProductPrice(), "USD"),
                    p.getStockQuantity() == null ? 0 : p.getStockQuantity()));
        }
        return new ChatResult("catalog_lookup", "Matching products: " + joiner);
    }

    // -------------------------------------------------------------------------
    // Default / summary — via ProductService
    // -------------------------------------------------------------------------

    private ChatResult resolveDefault() {
        List<ProductDto> all = productService.getAllProducts();
        long activeProducts = all.stream().filter(p -> Boolean.TRUE.equals(p.getActive())).count();

        AdminDashboardResponse dashboard = adminDashboardService.getDashboard(
                DASHBOARD_DAYS, DASHBOARD_RECENT_LIMIT, LOW_STOCK_THRESHOLD);
        long pendingOrders = dashboard.pendingOrders();

        return new ChatResult("summary", String.format(
                "Live summary: %d active products, %d pending orders. " +
                "Ask about low stock, top selling, revenue, a specific order number, customer email, or product prices.",
                activeProducts, pendingOrders
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

    private String formatOrderSummaryForStaff(OrderHistoryItemDto o) {
        String date = o.getCreatedAt() != null
                ? o.getCreatedAt().format(DateTimeFormatter.ISO_LOCAL_DATE)
                : "-";
        return String.format("Order %s is %s, payment %s, total %s (placed %s).",
                o.getOrderNumber(),
                o.getOrderStatus(),
                o.getPaymentStatus(),
                formatMoney(o.getTotalAmount(), o.getCurrency()),
                date);
    }

    private int toInt(Object value) {
        if (value instanceof Number n) return n.intValue();
        try { return Integer.parseInt(String.valueOf(value)); }
        catch (Exception e) { return 0; }
    }
}
