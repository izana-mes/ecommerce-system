package com.example.shop.modules.chatbot.service;

import com.example.shop.modules.chatbot.entity.ChatbotConversation;
import com.example.shop.modules.chatbot.entity.ChatbotMessage;
import com.example.shop.modules.chatbot.repository.ChatbotConversationRepository;
import com.example.shop.modules.chatbot.repository.ChatbotMessageRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

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
    private final ChatbotConversationRepository conversationRepository;
    private final ChatbotMessageRepository messageRepository;
    private final ChatbotAiClient chatbotAiClient;

    private static final Pattern ORDER_NUMBER_PATTERN =
            Pattern.compile("\\b([A-Z]{2,}[A-Z0-9_\\-]{2,})\\b", Pattern.CASE_INSENSITIVE);
    private static final Pattern EMAIL_PATTERN =
            Pattern.compile("\\b[A-Z0-9._%+\\-]+@[A-Z0-9.\\-]+\\.[A-Z]{2,}\\b", Pattern.CASE_INSENSITIVE);

    // -------------------------------------------------------------------------
    // Public API
    // -------------------------------------------------------------------------

    public record ChatResult(String intent, String answer, String conversationId, boolean usedAi) {}

    @Transactional
    public ChatResult buildAnswer(String question, String currentUserEmail, String guestId, String requestedConversationId) {
        String normalized = question.trim().replaceAll("\\s+", " ");
        ChatbotConversation conversation = getOrCreateConversation(currentUserEmail, guestId, requestedConversationId);
        saveMessage(conversation.getConversationId(), "user", normalized);

        String intent;
        String deterministicAnswer;
        if (isPolicyIntent(normalized)) {
            ChatResult result = resolvePolicyAnswer(normalized);
            intent = result.intent();
            deterministicAnswer = result.answer();
        } else if (isOrderIntent(normalized)) {
            ChatResult result = resolveOrderAnswer(normalized, currentUserEmail);
            intent = result.intent();
            deterministicAnswer = result.answer();
        } else if (isCatalogIntent(normalized)) {
            ChatResult result = resolveCatalogAnswer(normalized);
            intent = result.intent();
            deterministicAnswer = result.answer();
        } else {
            ChatResult result = resolveFallback();
            intent = result.intent();
            deterministicAnswer = result.answer();
        }

        String context = buildContext(normalized, currentUserEmail, deterministicAnswer);
        List<String> recentMessages = buildRecentConversation(conversation.getConversationId());

        Optional<String> aiAnswer = chatbotAiClient.generateCustomerAnswer(
                normalized,
                deterministicAnswer,
                context,
                recentMessages
        );

        String finalAnswer = aiAnswer
                .map(answer -> answer.isBlank() ? deterministicAnswer : answer)
                .orElse(deterministicAnswer);

        saveMessage(conversation.getConversationId(), "assistant", finalAnswer);
        touchConversation(conversation);

        return new ChatResult(intent, finalAnswer, conversation.getConversationId(), aiAnswer.isPresent());
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
                    "For refunds, include your order number and contact support from the Contact page.",
                    null, false);
        }
        if (lower.contains("shipping") || lower.contains("delivery")) {
            return new ChatResult("policy_shipping",
                    "Shipping info: standard delivery times vary by destination. " +
                    "You can track shipment status from your order details once the order is dispatched.",
                    null, false);
        }
        if (lower.contains("payment") || lower.contains("cod") || lower.contains("cash on delivery")) {
            return new ChatResult("policy_payment",
                    "Supported payment methods include online payment options shown at checkout. " +
                    "Payment status updates appear in your order status after processing.",
                    null, false);
        }
        return new ChatResult("policy_general",
                "For support questions, share your order number and issue details. " +
                "You can also use the Contact page for direct assistance.",
                null, false);
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
                    "If you are not logged in, also include the order email.",
                    null, false);
        }

        String lookupEmail = (currentUserEmail != null && !currentUserEmail.isBlank())
                ? currentUserEmail : providedEmail;

        if (lookupEmail == null) {
            return new ChatResult("order_help",
                    "For privacy, please log in first or include the order email with your order number " +
                    "(example: ORD-1001 and name@email.com).",
                    null, false);
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
                    "I couldn't find an order with that order number and email combination.",
                    null, false);
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
        return new ChatResult("order_status", answer, null, false);
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
                    "I couldn't find matching products. Try a shorter product name keyword.",
                    null, false);
        }

        StringJoiner joiner = new StringJoiner(" | ");
        for (Map<String, Object> row : rows) {
            joiner.add(String.format("%s (%s) - %s, stock %s",
                    row.get("product_name"),
                    row.get("product_id"),
                    formatMoney(row.get("product_price"), "USD"),
                    row.get("stock_quantity")));
        }
        return new ChatResult("catalog_lookup", "Here are matching products: " + joiner, null, false);
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
                "Current catalog has " + count + " active products.",
                null, false);
    }

    private String buildContext(String question, String currentUserEmail, String deterministicAnswer) {
        StringBuilder context = new StringBuilder();
        context.append("Known support policy summary:\n");
        context.append("- Returns: eligible items can be returned within 30 days in original condition.\n");
        context.append("- Shipping: delivery times depend on destination; dispatched orders can be tracked from order details.\n");
        context.append("- Payments: payment methods are the ones shown at checkout; payment status updates after processing.\n\n");

        context.append("Deterministic backend answer:\n");
        context.append(deterministicAnswer).append("\n\n");

        context.append("Catalog snapshot:\n");
        Integer total = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM products WHERE active = TRUE",
                Integer.class
        );
        context.append("- Active products: ").append(total == null ? 0 : total).append('\n');

        List<Map<String, Object>> productRows = jdbcTemplate.queryForList(
                """
                SELECT product_id, product_name, product_price, stock_quantity
                FROM products
                WHERE active = TRUE
                  AND LOWER(product_name) LIKE LOWER(?)
                ORDER BY stock_quantity DESC, product_name ASC
                LIMIT 5
                """,
                "%" + (extractCatalogKeyword(question).isBlank() ? question : extractCatalogKeyword(question)) + "%"
        );

        if (productRows.isEmpty()) {
            context.append("- Matching products: none\n");
        } else {
            for (Map<String, Object> row : productRows) {
                context.append("- ")
                        .append(row.get("product_name"))
                        .append(" [")
                        .append(row.get("product_id"))
                        .append("], price ")
                        .append(formatMoney(row.get("product_price"), "USD"))
                        .append(", stock ")
                        .append(row.get("stock_quantity"))
                        .append('\n');
            }
        }

        String orderNumber = extractOrderNumber(question);
        String providedEmail = extractEmail(question);
        String lookupEmail = (currentUserEmail != null && !currentUserEmail.isBlank()) ? currentUserEmail : providedEmail;
        context.append("\nOrder lookup:\n");
        if (orderNumber == null || lookupEmail == null) {
            context.append("- No verified order lookup available for this question.\n");
        } else {
            List<Map<String, Object>> orders = jdbcTemplate.queryForList(
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
            if (orders.isEmpty()) {
                context.append("- No order found for the provided order number/email combination.\n");
            } else {
                Map<String, Object> order = orders.get(0);
                context.append("- Order ")
                        .append(order.get("order_number"))
                        .append(": status ")
                        .append(order.get("order_status"))
                        .append(", payment ")
                        .append(order.get("payment_status"))
                        .append(", total ")
                        .append(formatMoney(order.get("total_amount"), String.valueOf(order.getOrDefault("currency", "USD"))))
                        .append(", created ")
                        .append(formatDate(order.get("created_at")))
                        .append('\n');
            }
        }

        return context.toString();
    }

    private List<String> buildRecentConversation(String conversationId) {
        List<ChatbotMessage> recent = new ArrayList<>(messageRepository.findTop8ByConversationIdOrderByCreatedAtDesc(conversationId));
        Collections.reverse(recent);
        List<String> messages = new ArrayList<>(recent.size());
        for (ChatbotMessage message : recent) {
            messages.add(message.getMessageRole() + ": " + message.getBody());
        }
        return messages;
    }

    private ChatbotConversation getOrCreateConversation(String userEmail, String guestId, String requestedConversationId) {
        if (requestedConversationId != null && !requestedConversationId.isBlank()) {
            Optional<ChatbotConversation> requested = conversationRepository.findById(requestedConversationId.trim());
            if (requested.isPresent() && canAccessConversation(requested.get(), userEmail, guestId)) {
                return requested.get();
            }
        }

        if (userEmail != null && !userEmail.isBlank()) {
            Optional<ChatbotConversation> existing = conversationRepository.findFirstByUserEmailIgnoreCaseOrderByLastMessageAtDesc(userEmail);
            if (existing.isPresent()) {
                return existing.get();
            }
        }

        if (guestId != null && !guestId.isBlank()) {
            Optional<ChatbotConversation> existing = conversationRepository.findFirstByGuestIdOrderByLastMessageAtDesc(guestId.trim());
            if (existing.isPresent()) {
                return existing.get();
            }
        }

        return conversationRepository.save(ChatbotConversation.builder()
                .conversationId("botconv_" + UUID.randomUUID().toString().replace("-", ""))
                .userEmail((userEmail == null || userEmail.isBlank()) ? null : userEmail.trim().toLowerCase())
                .guestId((guestId == null || guestId.isBlank()) ? null : guestId.trim())
                .createdAt(LocalDateTime.now())
                .updatedAt(LocalDateTime.now())
                .lastMessageAt(LocalDateTime.now())
                .build());
    }

    private boolean canAccessConversation(ChatbotConversation conversation, String userEmail, String guestId) {
        if (userEmail != null && conversation.getUserEmail() != null) {
            return conversation.getUserEmail().equalsIgnoreCase(userEmail);
        }
        if (guestId != null && conversation.getGuestId() != null) {
            return conversation.getGuestId().equals(guestId.trim());
        }
        return conversation.getUserEmail() == null && conversation.getGuestId() == null;
    }

    private void saveMessage(String conversationId, String role, String body) {
        messageRepository.save(ChatbotMessage.builder()
                .messageId("botmsg_" + UUID.randomUUID().toString().replace("-", ""))
                .conversationId(conversationId)
                .messageRole(role)
                .body(body)
                .createdAt(LocalDateTime.now())
                .build());
    }

    private void touchConversation(ChatbotConversation conversation) {
        conversation.setUpdatedAt(LocalDateTime.now());
        conversation.setLastMessageAt(LocalDateTime.now());
        conversationRepository.save(conversation);
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
