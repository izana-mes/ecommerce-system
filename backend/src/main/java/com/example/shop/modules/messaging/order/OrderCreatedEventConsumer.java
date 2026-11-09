package com.example.shop.modules.messaging.order;

import com.example.shop.common.mail.EmailService;
import com.example.shop.common.mail.EmailTemplateService;
import com.example.shop.config.ConditionalOnRabbitEnabled;
import com.example.shop.modules.notification.service.CustomerNotificationService;
import com.example.shop.modules.notification.service.OrderCreatedNotificationService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

import java.time.Duration;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Component
@RequiredArgsConstructor
@ConditionalOnRabbitEnabled
@Slf4j
public class OrderCreatedEventConsumer {

    private final OrderCreatedNotificationService orderCreatedNotificationService;
    private final CustomerNotificationService customerNotificationService;
    private final EmailTemplateService emailTemplateService;
    private final EmailService emailService;
    private final JdbcTemplate jdbcTemplate;
    private final ObjectProvider<StringRedisTemplate> redisTemplateProvider;

    @Value("${application.frontend.url:http://localhost:3000}")
    private String frontendBaseUrl;

    private static final Duration DEDUP_TTL = Duration.ofHours(24);

    @RabbitListener(queues = "${application.messaging.queue.order-created}")
    public void consume(OrderCreatedEvent event) {
        if (event == null || event.getOrderNumber() == null || event.getOrderNumber().isBlank()) {
            log.warn("Received null or invalid order created event");
            return;
        }

        StringRedisTemplate redis = redisTemplateProvider.getIfAvailable();
        if (redis != null) {
            String dedupKey = "msg:idemp:order-created:" + event.getOrderNumber().trim();
            try {
                Boolean isNew = redis.opsForValue().setIfAbsent(dedupKey, "1", DEDUP_TTL);
                if (Boolean.FALSE.equals(isNew)) {
                    log.info("Duplicate order created event skipped for order {}", event.getOrderNumber());
                    return;
                }
            } catch (Exception ex) {
                log.warn("Redis dedup check failed for order created {}, processing anyway: {}",
                        event.getOrderNumber(), ex.getMessage());
            }
        }

        log.info("Consumed order created event for order {}", event.getOrderNumber());
        orderCreatedNotificationService.sendOrderReceivedEmail(event);
        notifySellers(event);
        notifySuppliers(event);
    }

    private void notifySellers(OrderCreatedEvent event) {
        if (event == null || event.getOrderId() == null) return;
        try {
            List<Map<String, Object>> sellers = jdbcTemplate.queryForList("""
                    SELECT DISTINCT COALESCE(oi.seller_user_id, p.seller_user_id) AS seller_id, u.email, u.first_name, u.last_name
                    FROM order_items oi
                    JOIN products p ON p.product_id = oi.product_id
                    JOIN users u ON u.users_id = COALESCE(oi.seller_user_id, p.seller_user_id)
                    WHERE oi.order_id = ? AND COALESCE(oi.seller_user_id, p.seller_user_id) IS NOT NULL
                    """, event.getOrderId());

            String customerName = ((event.getCustomerFirstName() == null ? "" : event.getCustomerFirstName().trim()) + " "
                    + (event.getCustomerLastName() == null ? "" : event.getCustomerLastName().trim())).trim();
            if (customerName.isBlank()) customerName = "A customer";

            for (Map<String, Object> sellerRow : sellers) {
                Object rawId = sellerRow.get("seller_id");
                if (rawId == null) continue;
                UUID sellerId = rawId instanceof UUID ? (UUID) rawId : UUID.fromString(rawId.toString());
                String sellerEmail = (String) sellerRow.get("email");
                String sellerName = ((sellerRow.get("first_name") == null ? "" : sellerRow.get("first_name").toString().trim()) + " "
                        + (sellerRow.get("last_name") == null ? "" : sellerRow.get("last_name").toString().trim())).trim();
                if (sellerName.isBlank()) sellerName = "Seller";

                // In-App Notification
                customerNotificationService.createForUser(
                        sellerId,
                        "seller-new-order:" + event.getOrderNumber() + ":" + sellerId,
                        "order",
                        "New Order #" + event.getOrderNumber(),
                        "You have a new customer order containing products from your store.",
                        "/seller/orders",
                        event.getOrderNumber()
                );

                // Email Notification
                if (StringUtils.hasText(sellerEmail)) {
                    try {
                        String itemsSummary = (event.getItems() != null && !event.getItems().isEmpty())
                                ? event.getItems().size() + " item(s)"
                                : "Ordered products";
                        String emailContent = emailTemplateService.generateSellerNewOrderEmail(
                                sellerName,
                                event.getOrderNumber(),
                                customerName,
                                itemsSummary,
                                frontendBaseUrl + "/seller/orders"
                        );
                        emailService.sendEmail(sellerEmail, "New Order Received - " + event.getOrderNumber(), emailContent);
                    } catch (Exception ex) {
                        log.warn("Failed to send seller new-order email to {}: {}", sellerEmail, ex.getMessage());
                    }
                }
            }
        } catch (Exception ex) {
            log.error("Failed to notify sellers for order {}: {}", event.getOrderNumber(), ex.getMessage());
        }
    }

    private void notifySuppliers(OrderCreatedEvent event) {
        if (event == null || event.getOrderId() == null) return;
        try {
            List<Map<String, Object>> suppliers = jdbcTemplate.queryForList("""
                    SELECT DISTINCT COALESCE(oi.supplier_user_id, p.supplier_user_id) AS supplier_id
                    FROM order_items oi
                    JOIN products p ON p.product_id = oi.product_id
                    WHERE oi.order_id = ? AND COALESCE(oi.supplier_user_id, p.supplier_user_id) IS NOT NULL
                    """, event.getOrderId());
            for (Map<String, Object> row : suppliers) {
                Object rawId = row.get("supplier_id");
                if (rawId == null) continue;
                UUID supplierId = rawId instanceof UUID ? (UUID) rawId : UUID.fromString(rawId.toString());
                customerNotificationService.createForUser(supplierId,
                        "supplier-fulfillment-order:" + event.getOrderNumber() + ":" + supplierId,
                        "order", "Supplier fulfillment order #" + event.getOrderNumber(),
                        "A customer order includes products sourced from your inventory.",
                        "/supplier/dashboard", event.getOrderNumber());
            }
        } catch (Exception ex) {
            log.warn("Could not notify Supplier fulfillment recipients for order {}: {}", event.getOrderNumber(), ex.getMessage());
        }
    }
}

