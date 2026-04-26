package com.example.shop.modules.chatbot.service;

import com.example.shop.modules.chatbot.entity.ChatbotConversation;
import com.example.shop.modules.chatbot.entity.ChatbotMessage;
import com.example.shop.modules.chatbot.repository.ChatbotConversationRepository;
import com.example.shop.modules.chatbot.repository.ChatbotMessageRepository;
import com.example.shop.modules.order.dto.OrderHistoryItemDto;
import com.example.shop.modules.order.service.OrderService;
import com.example.shop.modules.product.dto.ProductDto;
import com.example.shop.modules.product.service.ProductService;
import com.example.shop.modules.user.entity.User;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.text.NumberFormat;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Customer chatbot service.
 * All database access goes through the service layer (ProductService, OrderService).
 * Order lookup is strictly scoped to the authenticated customer's own email — a guest
 * user who is not logged in will be asked to log in before any order data is returned.
 */
@Service
@RequiredArgsConstructor
public class ChatbotService {

    private final ProductService productService;
    private final OrderService orderService;
    private final ChatbotConversationRepository conversationRepository;
    private final ChatbotMessageRepository messageRepository;
    private final ChatbotAiClient chatbotAiClient;

    private static final Pattern ORDER_NUMBER_PATTERN =
            Pattern.compile("\\b([A-Z]{2,}[A-Z0-9_\\-]{2,})\\b", Pattern.CASE_INSENSITIVE);

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
    // Policy (no DB access needed)
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
    // Order lookup — scoped to authenticated customer only
    // -------------------------------------------------------------------------

    private ChatResult resolveOrderAnswer(String question, String currentUserEmail) {
        // Customer must be authenticated — we only look up their own orders.
        if (currentUserEmail == null || currentUserEmail.isBlank()) {
            return new ChatResult("order_auth_required",
                    "To check your order status, please log in first. " +
                    "Once logged in, ask again and I'll look up your orders right away.",
                    null, false);
        }

        String orderNumber = extractOrderNumber(question);

        // Fetch up to 5 of the customer's own recent orders
        // Use a synthetic User object to call service.getMyOrders(user, limit)
        User syntheticUser = buildSyntheticUser(currentUserEmail);
        List<OrderHistoryItemDto> myOrders = orderService.getMyOrders(syntheticUser, 5);

        if (myOrders.isEmpty()) {
            return new ChatResult("order_not_found",
                    "I couldn't find any orders linked to your account. " +
                    "If you placed an order as a guest with a different email, please contact support.",
                    null, false);
        }

        // If a specific order number was mentioned, try to find it in the customer's orders
        if (orderNumber != null) {
            final String orderNumUpper = orderNumber.toUpperCase();
            Optional<OrderHistoryItemDto> matched = myOrders.stream()
                    .filter(o -> o.getOrderNumber() != null && o.getOrderNumber().toUpperCase().equals(orderNumUpper))
                    .findFirst();
            if (matched.isPresent()) {
                return new ChatResult("order_status", formatOrderSummary(matched.get()), null, false);
            }
            // If the mentioned order number isn't in their last 5, it's either very old or not theirs
            return new ChatResult("order_not_found",
                    "I couldn't find order " + orderNumber + " in your recent orders. " +
                    "It may be older than your 5 most recent, or belong to a different account. " +
                    "Please contact support for more details.",
                    null, false);
        }

        // No specific order number — return recent order list
        StringJoiner joiner = new StringJoiner(" | ");
        for (OrderHistoryItemDto o : myOrders) {
            joiner.add(String.format("%s: %s/%s, %s",
                    o.getOrderNumber(),
                    o.getOrderStatus(),
                    o.getPaymentStatus(),
                    formatMoney(o.getTotalAmount(), o.getCurrency())));
        }
        return new ChatResult("order_list", "Your recent orders: " + joiner, null, false);
    }

    // -------------------------------------------------------------------------
    // Catalog search
    // -------------------------------------------------------------------------

    private ChatResult resolveCatalogAnswer(String question) {
        String keyword = extractCatalogKeyword(question);
        List<ProductDto> results = productService.searchProducts(keyword.isBlank() ? question : keyword);

        if (results.isEmpty()) {
            return new ChatResult("catalog_not_found",
                    "I couldn't find matching products. Try a shorter product name keyword.",
                    null, false);
        }

        List<ProductDto> visible = results.stream()
                .filter(p -> Boolean.TRUE.equals(p.getActive()))
                .limit(5)
                .toList();

        if (visible.isEmpty()) {
            return new ChatResult("catalog_not_found",
                    "No active products matched your search. Try a different keyword.",
                    null, false);
        }

        StringJoiner joiner = new StringJoiner(" | ");
        for (ProductDto p : visible) {
            joiner.add(String.format("%s (%s) - %s, stock %d",
                    p.getProductName(),
                    p.getProductID(),
                    formatMoney(p.getProductPrice(), "USD"),
                    p.getStockQuantity() == null ? 0 : p.getStockQuantity()));
        }
        return new ChatResult("catalog_lookup", "Here are matching products: " + joiner, null, false);
    }

    // -------------------------------------------------------------------------
    // Fallback
    // -------------------------------------------------------------------------

    private ChatResult resolveFallback() {
        long count = productService.getAllProducts().stream()
                .filter(p -> Boolean.TRUE.equals(p.getActive()))
                .count();
        return new ChatResult("fallback",
                "I can help with product questions, stock and prices, shipping/returns, and order status. " +
                "Current catalog has " + count + " active products.",
                null, false);
    }

    // -------------------------------------------------------------------------
    // Context builder for AI layer
    // -------------------------------------------------------------------------

    private String buildContext(String question, String currentUserEmail, String deterministicAnswer) {
        StringBuilder context = new StringBuilder();
        context.append("Known support policy summary:\n");
        context.append("- Returns: eligible items can be returned within 30 days in original condition.\n");
        context.append("- Shipping: delivery times depend on destination; dispatched orders can be tracked from order details.\n");
        context.append("- Payments: payment methods are the ones shown at checkout; payment status updates after processing.\n\n");

        context.append("Deterministic backend answer:\n");
        context.append(deterministicAnswer).append("\n\n");

        // Catalog snapshot — use service layer (cached)
        context.append("Catalog snapshot:\n");
        List<ProductDto> allProducts = productService.getAllProducts();
        long activeCount = allProducts.stream().filter(p -> Boolean.TRUE.equals(p.getActive())).count();
        context.append("- Active products: ").append(activeCount).append('\n');

        String keyword = extractCatalogKeyword(question);
        List<ProductDto> matching = productService.searchProducts(keyword.isBlank() ? question : keyword)
                .stream()
                .filter(p -> Boolean.TRUE.equals(p.getActive()))
                .limit(5)
                .toList();

        if (matching.isEmpty()) {
            context.append("- Matching products: none\n");
        } else {
            for (ProductDto p : matching) {
                context.append("- ")
                        .append(p.getProductName())
                        .append(" [")
                        .append(p.getProductID())
                        .append("], price ")
                        .append(formatMoney(p.getProductPrice(), "USD"))
                        .append(", stock ")
                        .append(p.getStockQuantity() == null ? 0 : p.getStockQuantity())
                        .append('\n');
            }
        }

        // Order context — only if authenticated
        context.append("\nOrder lookup:\n");
        if (currentUserEmail == null || currentUserEmail.isBlank()) {
            context.append("- Customer is not authenticated — order lookup not available.\n");
        } else {
            String orderNumber = extractOrderNumber(question);
            User syntheticUser = buildSyntheticUser(currentUserEmail);
            List<OrderHistoryItemDto> myOrders = orderService.getMyOrders(syntheticUser, 5);
            if (myOrders.isEmpty()) {
                context.append("- No orders found for this customer.\n");
            } else if (orderNumber != null) {
                final String upper = orderNumber.toUpperCase();
                myOrders.stream()
                        .filter(o -> o.getOrderNumber() != null && o.getOrderNumber().toUpperCase().equals(upper))
                        .findFirst()
                        .ifPresentOrElse(
                                o -> context.append("- ").append(formatOrderSummary(o)).append('\n'),
                                () -> context.append("- Order ").append(orderNumber).append(" not found in customer's recent orders.\n")
                        );
            } else {
                context.append("- Recent orders: ")
                        .append(myOrders.stream()
                                .map(o -> o.getOrderNumber() + " (" + o.getOrderStatus() + "/" + o.getPaymentStatus() + ")")
                                .reduce((a, b) -> a + ", " + b)
                                .orElse("none"))
                        .append('\n');
            }
        }

        return context.toString();
    }

    // -------------------------------------------------------------------------
    // Conversation helpers
    // -------------------------------------------------------------------------

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

    private String formatOrderSummary(OrderHistoryItemDto o) {
        String date = o.getCreatedAt() != null
                ? o.getCreatedAt().format(DateTimeFormatter.ISO_LOCAL_DATE)
                : "-";
        return String.format("Order %s is %s, payment %s, total %s (placed %s)",
                o.getOrderNumber(),
                o.getOrderStatus(),
                o.getPaymentStatus(),
                formatMoney(o.getTotalAmount(), o.getCurrency()),
                date);
    }

    /**
     * Builds a minimal synthetic User containing only the email,
     * which is all that OrderService.getMyOrders() requires.
     */
    private User buildSyntheticUser(String email) {
        User user = new User();
        user.setEmail(email);
        return user;
    }
}
