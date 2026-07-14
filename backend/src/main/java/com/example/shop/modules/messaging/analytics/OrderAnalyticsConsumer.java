package com.example.shop.modules.messaging.analytics;

import com.example.shop.config.ConditionalOnRabbitEnabled;
import com.example.shop.modules.messaging.order.OrderCreatedEvent;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Component
@RequiredArgsConstructor
@ConditionalOnRabbitEnabled
@Slf4j
public class OrderAnalyticsConsumer {

    private final JdbcTemplate jdbcTemplate;

    @RabbitListener(queues = "${application.messaging.queue.order-created-analytics}")
    @Transactional
    public void consume(OrderCreatedEvent event) {
        if (event == null || event.getOrderId() == null) {
            log.warn("Received null/incomplete order created event for analytics");
            return;
        }

        if (!markEventProcessed(event)) {
            log.debug("Skipping already processed analytics event for order {}", event.getOrderNumber());
            return;
        }

        LocalDate day = resolveDay(event.getCreatedAt());
        String currency = normalizeCurrency(event.getCurrency());
        String paymentMethod = normalizePaymentMethod(event.getPaymentMethod());
        BigDecimal totalAmount = event.getTotalAmount() == null ? BigDecimal.ZERO : event.getTotalAmount();

        jdbcTemplate.update("""
                INSERT INTO order_analytics_daily (day, currency, payment_method, orders_count, gross_revenue, updated_at)
                VALUES (?, ?, ?, 1, ?, CURRENT_TIMESTAMP)
                ON CONFLICT (day, currency, payment_method)
                DO UPDATE SET
                    orders_count = order_analytics_daily.orders_count + 1,
                    gross_revenue = order_analytics_daily.gross_revenue + EXCLUDED.gross_revenue,
                    updated_at = CURRENT_TIMESTAMP
                """,
                day,
                currency,
                paymentMethod,
                totalAmount
        );

        log.info("Order analytics updated: order={} day={} currency={} paymentMethod={} amount={}",
                event.getOrderNumber(), day, currency, paymentMethod, totalAmount);
    }

    private boolean markEventProcessed(OrderCreatedEvent event) {
        Integer inserted = jdbcTemplate.queryForObject("""
                INSERT INTO order_analytics_events (order_id, order_number, event_created_at)
                VALUES (?, ?, ?)
                ON CONFLICT (order_id) DO NOTHING
                RETURNING 1
                """,
                Integer.class,
                event.getOrderId(),
                safeOrderNumber(event.getOrderNumber()),
                event.getCreatedAt() == null ? LocalDateTime.now() : event.getCreatedAt()
        );
        return inserted != null;
    }

    private LocalDate resolveDay(LocalDateTime createdAt) {
        return (createdAt == null ? LocalDateTime.now() : createdAt).toLocalDate();
    }

    private String normalizeCurrency(String currency) {
        if (currency == null || currency.isBlank()) {
            return "USD";
        }
        String upper = currency.trim().toUpperCase();
        return upper.length() > 3 ? upper.substring(0, 3) : upper;
    }

    private String normalizePaymentMethod(String paymentMethod) {
        if (paymentMethod == null || paymentMethod.isBlank()) {
            return "unknown";
        }
        return paymentMethod.trim().toLowerCase();
    }

    private String safeOrderNumber(String orderNumber) {
        if (orderNumber == null || orderNumber.isBlank()) {
            return "unknown";
        }
        return orderNumber.trim();
    }
}
