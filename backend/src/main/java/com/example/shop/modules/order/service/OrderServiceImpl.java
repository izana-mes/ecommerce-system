package com.example.shop.modules.order.service;

import com.example.shop.common.exception.BusinessException;
import com.example.shop.modules.cart.entity.CartItem;
import com.example.shop.modules.cart.repository.CartItemRepository;
import com.example.shop.modules.messaging.inventory.LowStockAlertEvent;
import com.example.shop.modules.messaging.inventory.LowStockAlertPublisher;
import com.example.shop.modules.messaging.order.OrderCreatedEvent;
import com.example.shop.modules.messaging.order.OrderCreatedEventPublisher;
import com.example.shop.modules.order.dto.OrderCreateRequest;
import com.example.shop.modules.order.dto.OrderCreateResponse;
import com.example.shop.modules.order.dto.OrderHistoryItemDto;
import com.example.shop.modules.order.dto.OrderTrackingDto;
import com.example.shop.modules.order.dto.OrderTrackingLineDto;
import com.example.shop.modules.product.entity.Product;
import com.example.shop.modules.product.repository.ProductRepository;
import com.example.shop.modules.user.entity.User;
import com.example.shop.modules.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.jdbc.support.KeyHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.sql.Timestamp;
import java.time.LocalDateTime;
import java.util.*;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Transactional
@Slf4j
public class OrderServiceImpl implements OrderService {

    private final ProductRepository productRepository;
    private final CartItemRepository cartItemRepository;
    private final UserRepository userRepository;
    private final JdbcTemplate jdbcTemplate;
    private final OrderCreatedEventPublisher orderCreatedEventPublisher;
    private final LowStockAlertPublisher lowStockAlertPublisher;

    @Value("${application.inventory.low-stock-threshold:5}")
    private int lowStockThreshold;

    private static final int POINTS_PER_USD_DISCOUNT = 100;
    private static final BigDecimal MAX_POINTS_DISCOUNT_RATE = new BigDecimal("0.25");
    private static final BigDecimal EARNING_RATE = new BigDecimal("0.05");

    @Override
    public OrderCreateResponse createOrder(OrderCreateRequest request, User user) {
        validateRequest(request);
        String effectiveEmail = user != null && StringUtils.hasText(user.getEmail())
                ? normalizeEmail(user.getEmail())
                : normalizeEmail(request.getCustomerEmail());
        if (!StringUtils.hasText(effectiveEmail) || !isValidEmail(effectiveEmail)) {
            throw new BusinessException("customerEmail is required and must be valid", HttpStatus.BAD_REQUEST);
        }

        Map<String, Integer> requestedQtyByProductId = new LinkedHashMap<>();
        for (OrderCreateRequest.Item item : request.getItems()) {
            String productId = safe(item.getProductID());
            requestedQtyByProductId.merge(productId, item.getQuantity(), Integer::sum);
        }
        List<String> productIds = requestedQtyByProductId.keySet().stream().toList();

        Map<String, Product> productsById = productRepository.findByProductIDIn(productIds)
                .stream()
                .collect(Collectors.toMap(Product::getProductID, Function.identity()));

        if (productsById.size() != productIds.size()) {
            throw new BusinessException("One or more products were not found", HttpStatus.NOT_FOUND);
        }

        List<OrderLine> orderLines = new ArrayList<>();
        BigDecimal subtotal = BigDecimal.ZERO;
        for (Map.Entry<String, Integer> entry : requestedQtyByProductId.entrySet()) {
            Product product = productsById.get(entry.getKey());
            if (product == null || Boolean.FALSE.equals(product.getActive())) {
                throw new BusinessException("Product is unavailable: " + entry.getKey(), HttpStatus.CONFLICT);
            }

            int quantity = entry.getValue();
            int stock = product.getStockQuantity() == null ? 0 : product.getStockQuantity();
            if (quantity > stock) {
                throw new BusinessException(
                        "Insufficient stock for product " + product.getProductID() + " (available: " + stock + ")",
                        HttpStatus.CONFLICT
                );
            }

            BigDecimal unitPrice = money(product.getProductPrice());
            BigDecimal lineTotal = unitPrice.multiply(BigDecimal.valueOf(quantity)).setScale(2, RoundingMode.HALF_UP);

            orderLines.add(new OrderLine(product, quantity, unitPrice, lineTotal));
            subtotal = subtotal.add(lineTotal);
        }

        BigDecimal shippingFee = request.getShippingFee() == null ? (subtotal.compareTo(BigDecimal.ZERO) > 0 ? money(5) : BigDecimal.ZERO) : money(request.getShippingFee());
        BigDecimal vat = request.getVat() == null ? (subtotal.compareTo(BigDecimal.ZERO) > 0 ? money(11) : BigDecimal.ZERO) : money(request.getVat());
        BigDecimal discountAmount = request.getCouponDiscount() == null
                ? BigDecimal.ZERO
                : money(Math.max(0D, request.getCouponDiscount()));
        BigDecimal maxAllowedDiscount = subtotal.add(shippingFee).add(vat).setScale(2, RoundingMode.HALF_UP);
        if (discountAmount.compareTo(maxAllowedDiscount) > 0) {
            discountAmount = maxAllowedDiscount;
        }
        BigDecimal prePointsTotal = subtotal.add(shippingFee).add(vat).subtract(discountAmount).max(BigDecimal.ZERO)
                .setScale(2, RoundingMode.HALF_UP);
        LoyaltyRedemption redemption = computeLoyaltyRedemption(request, user, prePointsTotal);
        BigDecimal totalAmount = prePointsTotal.subtract(redemption.discountAmount()).max(BigDecimal.ZERO)
                .setScale(2, RoundingMode.HALF_UP);
        int pointsEarned = totalAmount.multiply(EARNING_RATE)
                .setScale(0, RoundingMode.FLOOR)
                .intValue();

        String currency = safe(request.getCurrency()).isBlank() ? "USD" : safe(request.getCurrency()).toUpperCase(Locale.ROOT);
        if (currency.length() > 3) {
            currency = currency.substring(0, 3);
        }

        String orderNumber = generateOrderNumber();
        String trackingSecret = UUID.randomUUID().toString();

        InsertOrderResult inserted = insertOrder(
                request,
                user,
                effectiveEmail,
                orderNumber,
                trackingSecret,
                subtotal,
                shippingFee,
                vat,
                discountAmount,
                redemption.pointsRedeemed(),
                redemption.discountAmount(),
                pointsEarned,
                totalAmount,
                currency
        );
        Long orderId = inserted.id();
        insertOrderItems(orderId, orderLines);
        insertPayment(orderId, orderNumber, request.getPaymentMethod(), totalAmount, currency, request.getOrderSource());

        for (OrderLine line : orderLines) {
            Product product = line.product();
            int newStock = Math.max(0, (product.getStockQuantity() == null ? 0 : product.getStockQuantity()) - line.quantity());
            product.setStockQuantity(newStock);
            productRepository.save(product);

            // Publish low-stock alert if stock drops below threshold
            if (newStock <= lowStockThreshold) {
                try {
                    lowStockAlertPublisher.publish(LowStockAlertEvent.builder()
                            .productId(product.getProductID())
                            .productName(product.getProductName())
                            .remainingStock(newStock)
                            .orderNumber(orderNumber)
                            .build());
                } catch (Exception e) {
                    log.error("Failed to publish low stock alert for product {}", product.getProductID(), e);
                }
            }
        }

        clearPurchasedCartItems(user, orderLines);
        long remainingPoints = applyLoyaltyChanges(user, redemption.pointsRedeemed(), pointsEarned);

        // Publish order created event for async notification
        try {
            orderCreatedEventPublisher.publish(OrderCreatedEvent.builder()
                    .orderId(orderId)
                    .orderNumber(orderNumber)
                    .trackingSecret(trackingSecret)
                    .customerEmail(effectiveEmail)
                    .customerFirstName(request.getCustomerFirstName())
                    .customerLastName(request.getCustomerLastName())
                    .customerPhone(request.getCustomerPhone())
                    .shippingAddressLine1(request.getShippingAddressLine1())
                    .shippingAddressLine2(request.getShippingAddressLine2())
                    .shippingCity(request.getShippingCity())
                    .shippingState(request.getShippingState())
                    .shippingPostalCode(request.getShippingPostalCode())
                    .shippingCountry(request.getShippingCountry())
                    .notes(request.getNotes())
                    .subtotal(subtotal)
                    .shippingFee(shippingFee)
                    .vat(vat)
                    .discountAmount(discountAmount)
                    .totalAmount(totalAmount)
                    .currency(currency)
                    .paymentMethod(request.getPaymentMethod())
                    .items(orderLines.stream()
                            .map(line -> OrderCreatedEvent.OrderItemSnapshot.builder()
                                    .productId(line.product().getProductID())
                                    .productName(line.product().getProductName())
                                    .unitPrice(line.unitPrice())
                                    .quantity(line.quantity())
                                    .lineTotal(line.lineTotal())
                                    .build())
                            .toList())
                    .build());
        } catch (Exception e) {
            log.error("Failed to publish order created event for order {}", orderNumber, e);
        }

        return OrderCreateResponse.builder()
                .orderId(orderId)
                .orderNumber(orderNumber)
                .trackingSecret(trackingSecret)
                .subtotal(subtotal)
                .shippingFee(shippingFee)
                .vat(vat)
                .discountAmount(discountAmount)
                .totalAmount(totalAmount)
                .currency(currency)
                .couponCode(nullable(request.getCouponCode()))
                .pointsRedeemed(redemption.pointsRedeemed())
                .pointsDiscountAmount(redemption.discountAmount())
                .pointsEarned(pointsEarned)
                .remainingPoints(remainingPoints)
                .paymentStatus("pending")
                .orderStatus("pending")
                .build();
    }

    @Override
    @Transactional(readOnly = true)
    public Optional<OrderHistoryItemDto> findOrderByNumberForAdmin(String orderNumber) {
        if (!StringUtils.hasText(orderNumber)) {
            return Optional.empty();
        }
        List<OrderHistoryItemDto> rows = jdbcTemplate.query(
                """
                SELECT o.id,
                       o.order_number,
                       MAX(o.tracking_secret) AS tracking_secret,
                       o.customer_email,
                       o.customer_first_name,
                       o.customer_last_name,
                       o.total_amount,
                       o.currency,
                       o.payment_method,
                       o.payment_status,
                       o.order_status,
                       o.created_at,
                       o.updated_at,
                       o.shipping_carrier,
                       o.shipping_tracking_public,
                       o.shipped_at,
                       COALESCE(SUM(oi.quantity), 0) AS item_count
                FROM orders o
                LEFT JOIN order_items oi ON oi.order_id = o.id
                WHERE UPPER(o.order_number) = UPPER(?)
                GROUP BY o.id
                ORDER BY o.created_at DESC
                LIMIT 1
                """,
                (rs, rowNum) -> mapOrderHistoryRow(rs),
                orderNumber.toUpperCase()
        );
        return rows.isEmpty() ? Optional.empty() : Optional.of(rows.get(0));
    }

    @Override
    @Transactional(readOnly = true)
    public List<OrderHistoryItemDto> findOrdersByEmailForAdmin(String email, int limit) {
        if (!StringUtils.hasText(email)) {
            return List.of();
        }
        int safeLimit = Math.min(Math.max(limit, 1), 100);
        return jdbcTemplate.query(
                """
                SELECT o.id,
                       o.order_number,
                       MAX(o.tracking_secret) AS tracking_secret,
                       o.customer_email,
                       o.customer_first_name,
                       o.customer_last_name,
                       o.total_amount,
                       o.currency,
                       o.payment_method,
                       o.payment_status,
                       o.order_status,
                       o.created_at,
                       o.updated_at,
                       o.shipping_carrier,
                       o.shipping_tracking_public,
                       o.shipped_at,
                       COALESCE(SUM(oi.quantity), 0) AS item_count
                FROM orders o
                LEFT JOIN order_items oi ON oi.order_id = o.id
                WHERE LOWER(o.customer_email) = LOWER(?)
                GROUP BY o.id
                ORDER BY o.created_at DESC
                LIMIT ?
                """,
                (rs, rowNum) -> mapOrderHistoryRow(rs),
                email,
                safeLimit
        );
    }

    @Override
    @Transactional(readOnly = true)
    public List<OrderHistoryItemDto> getMyOrders(User user, int limit) {
        if (user == null || !StringUtils.hasText(user.getEmail())) {
            throw new BusinessException("Unauthorized", HttpStatus.UNAUTHORIZED);
        }
        int safeLimit = Math.min(Math.max(limit, 1), 100);

        return jdbcTemplate.query(
                """
                        SELECT o.id,
                               o.order_number,
                               MAX(o.tracking_secret) AS tracking_secret,
                               o.customer_email,
                               o.customer_first_name,
                               o.customer_last_name,
                               o.total_amount,
                               o.currency,
                               o.payment_method,
                               o.payment_status,
                               o.order_status,
                               o.created_at,
                               o.updated_at,
                               o.shipping_carrier,
                               o.shipping_tracking_public,
                               o.shipped_at,
                               COALESCE(SUM(oi.quantity), 0) AS item_count
                        FROM orders o
                        LEFT JOIN order_items oi ON oi.order_id = o.id
                        WHERE LOWER(o.customer_email) = LOWER(?)
                        GROUP BY o.id
                        ORDER BY o.created_at DESC
                        LIMIT ?
                """,
                (rs, rowNum) -> mapOrderHistoryRow(rs),
                user.getEmail(),
                safeLimit
        );
    }

    @Override
    @Transactional(readOnly = true)
    public List<OrderHistoryItemDto> getFulfillmentQueue(User user, int limit) {
        if (user == null || !StringUtils.hasText(user.getEmail())) {
            throw new BusinessException("Unauthorized", HttpStatus.UNAUTHORIZED);
        }
        if (!hasFulfillmentStaffRole(user)) {
            throw new BusinessException("Forbidden", HttpStatus.FORBIDDEN);
        }
        int safeLimit = Math.min(Math.max(limit, 1), 100);
        if (hasAdminOrEmployeeRole(user)) {
            return queryRecentStaffWideOrderHistory(safeLimit);
        }
        return jdbcTemplate.query(
                """
                                SELECT o.id,
                                       o.order_number,
                                       MAX(o.tracking_secret) AS tracking_secret,
                                       o.customer_email,
                                       o.customer_first_name,
                                       o.customer_last_name,
                                       o.total_amount,
                                       o.currency,
                                       o.payment_method,
                                       o.payment_status,
                                       o.order_status,
                                       o.created_at,
                                       o.updated_at,
                                       o.shipping_carrier,
                                       o.shipping_tracking_public,
                                       o.shipped_at,
                                       COALESCE(SUM(oi.quantity), 0) AS item_count
                                FROM orders o
                                LEFT JOIN order_items oi ON oi.order_id = o.id
                                WHERE LOWER(o.order_status) <> 'cancelled'
                                GROUP BY o.id
                                ORDER BY o.updated_at DESC
                                LIMIT ?
                                """,
                (rs, rowNum) -> mapOrderHistoryRow(rs),
                safeLimit
        );
    }

    @Override
    @Transactional(readOnly = true)
    public Optional<OrderTrackingDto> getOrderTrackingBySecret(String trackingSecret) {
        if (!StringUtils.hasText(trackingSecret) || trackingSecret.length() > 80) {
            return Optional.empty();
        }
        List<Long> ids = jdbcTemplate.query(
                "SELECT id FROM orders WHERE tracking_secret = ? LIMIT 1",
                (rs, rowNum) -> rs.getLong("id"),
                trackingSecret.trim()
        );
        if (ids.isEmpty()) {
            return Optional.empty();
        }
        return loadOrderTracking(ids.get(0));
    }

    @Override
    @Transactional(readOnly = true)
    public Optional<OrderTrackingDto> getOrderTrackingByNumberForCustomer(String orderNumber, User user) {
        if (!StringUtils.hasText(orderNumber) || user == null || !StringUtils.hasText(user.getEmail())) {
            return Optional.empty();
        }
        List<Long> ids = jdbcTemplate.query(
                """
                        SELECT id FROM orders
                        WHERE UPPER(order_number) = UPPER(?) AND LOWER(customer_email) = LOWER(?)
                        LIMIT 1
                        """,
                (rs, rowNum) -> rs.getLong("id"),
                orderNumber.trim(),
                user.getEmail()
        );
        if (ids.isEmpty()) {
            return Optional.empty();
        }
        return loadOrderTracking(ids.get(0));
    }

    private Optional<OrderTrackingDto> loadOrderTracking(Long orderId) {
        List<OrderTrackingDto> headers = jdbcTemplate.query(
                """
                        SELECT order_number, order_status, payment_status, created_at,
                               shipping_city, shipping_country,
                               delivery_latitude, delivery_longitude, delivery_location_label,
                               delivery_location_accuracy_meters,
                               shipping_carrier, shipping_tracking_public, shipped_at
                        FROM orders WHERE id = ?
                        """,
                (rs, rowNum) -> OrderTrackingDto.builder()
                        .orderNumber(rs.getString("order_number"))
                        .orderStatus(rs.getString("order_status"))
                        .paymentStatus(rs.getString("payment_status"))
                        .createdAt(toLocalDateTime(rs.getTimestamp("created_at")))
                        .shippingCity(rs.getString("shipping_city"))
                        .shippingCountry(rs.getString("shipping_country"))
                        .deliveryLatitude(rs.getBigDecimal("delivery_latitude"))
                        .deliveryLongitude(rs.getBigDecimal("delivery_longitude"))
                        .deliveryLocationLabel(rs.getString("delivery_location_label"))
                        .deliveryLocationAccuracyMeters(rs.getBigDecimal("delivery_location_accuracy_meters"))
                        .shippingCarrier(rs.getString("shipping_carrier"))
                        .shippingTrackingPublic(rs.getString("shipping_tracking_public"))
                        .shippedAt(toLocalDateTime(rs.getTimestamp("shipped_at")))
                        .build(),
                orderId
        );
        if (headers.isEmpty()) {
            return Optional.empty();
        }
        OrderTrackingDto dto = headers.get(0);
        List<OrderTrackingLineDto> lines = jdbcTemplate.query(
                """
                        SELECT product_id, product_name, unit_price, quantity, line_total
                        FROM order_items WHERE order_id = ? ORDER BY id
                        """,
                (rs, rowNum) -> OrderTrackingLineDto.builder()
                        .productId(rs.getString("product_id"))
                        .productName(rs.getString("product_name"))
                        .unitPrice(rs.getBigDecimal("unit_price"))
                        .quantity(rs.getInt("quantity"))
                        .lineTotal(rs.getBigDecimal("line_total"))
                        .build(),
                orderId
        );
        dto.setItems(lines);
        return Optional.of(dto);
    }

    @Override
    public void cancelOrder(String orderNumber, User user) {
        if (!StringUtils.hasText(orderNumber) || user == null || !StringUtils.hasText(user.getEmail())) {
            throw new BusinessException("Invalid request", HttpStatus.BAD_REQUEST);
        }

        List<Map<String, Object>> rows = jdbcTemplate.queryForList(
                "SELECT id, order_status, payment_status FROM orders WHERE UPPER(order_number) = UPPER(?) AND LOWER(customer_email) = LOWER(?)",
                orderNumber, user.getEmail()
        );
        if (rows.isEmpty()) {
            throw new BusinessException("Order not found", HttpStatus.NOT_FOUND);
        }

        Map<String, Object> order = rows.get(0);
        Long orderId = ((Number) order.get("id")).longValue();
        String orderStatus = (String) order.get("order_status");
        String paymentStatus = (String) order.get("payment_status");

        if (!"pending".equalsIgnoreCase(orderStatus) || !"pending".equalsIgnoreCase(paymentStatus)) {
            throw new BusinessException("Only pending orders can be cancelled", HttpStatus.CONFLICT);
        }

        List<Map<String, Object>> items = jdbcTemplate.queryForList(
                "SELECT product_id, quantity FROM order_items WHERE order_id = ?",
                orderId
        );
        for (Map<String, Object> item : items) {
            String productId = (String) item.get("product_id");
            int quantity = ((Number) item.get("quantity")).intValue();
            
            productRepository.findByProductID(productId).ifPresent(product -> {
                int newStock = (product.getStockQuantity() == null ? 0 : product.getStockQuantity()) + quantity;
                product.setStockQuantity(newStock);
                productRepository.save(product);
            });
        }

        LocalDateTime now = LocalDateTime.now();
        jdbcTemplate.update(
                "UPDATE orders SET order_status = 'cancelled', payment_status = 'cancelled', updated_at = ? WHERE id = ?",
                Timestamp.valueOf(now), orderId
        );
        jdbcTemplate.update(
                "UPDATE payments SET status = 'cancelled', updated_at = ? WHERE order_id = ? AND status = 'pending'",
                Timestamp.valueOf(now), orderId
        );
    }

    @Override
    public OrderHistoryItemDto editOrder(String orderNumber, com.example.shop.modules.order.dto.OrderEditRequest request, User user) {
        if (!StringUtils.hasText(orderNumber) || user == null || !StringUtils.hasText(user.getEmail())) {
            throw new BusinessException("Invalid request", HttpStatus.BAD_REQUEST);
        }

        List<Map<String, Object>> rows = jdbcTemplate.queryForList(
                "SELECT id, order_status, payment_status FROM orders WHERE UPPER(order_number) = UPPER(?) AND LOWER(customer_email) = LOWER(?)",
                orderNumber, user.getEmail()
        );
        if (rows.isEmpty()) {
            throw new BusinessException("Order not found", HttpStatus.NOT_FOUND);
        }

        Map<String, Object> order = rows.get(0);
        Long orderId = ((Number) order.get("id")).longValue();
        String orderStatus = (String) order.get("order_status");
        String paymentStatus = (String) order.get("payment_status");

        if (!"pending".equalsIgnoreCase(orderStatus) || !"pending".equalsIgnoreCase(paymentStatus)) {
            throw new BusinessException("Only pending orders can be edited", HttpStatus.CONFLICT);
        }

        LocalDateTime now = LocalDateTime.now();
        jdbcTemplate.update(
                """
                UPDATE orders SET
                    customer_first_name = ?, customer_last_name = ?, customer_phone = ?,
                    shipping_address_line1 = ?, shipping_address_line2 = ?, shipping_city = ?,
                    shipping_state = ?, shipping_postal_code = ?, shipping_country = ?,
                    delivery_latitude = ?, delivery_longitude = ?, delivery_location_label = ?,
                    delivery_location_accuracy_meters = ?, delivery_location_captured_at = ?,
                    notes = ?, updated_at = ?
                WHERE id = ?
                """,
                nullable(request.getCustomerFirstName()), nullable(request.getCustomerLastName()), nullable(request.getCustomerPhone()),
                nullable(request.getShippingAddressLine1()), nullable(request.getShippingAddressLine2()), nullable(request.getShippingCity()),
                nullable(request.getShippingState()), nullable(request.getShippingPostalCode()), nullable(request.getShippingCountry()),
                request.getDeliveryLatitude(), request.getDeliveryLongitude(), nullable(request.getDeliveryLocationLabel()),
                request.getDeliveryLocationAccuracyMeters(), request.getDeliveryLocationCapturedAt(),
                nullable(request.getNotes()), Timestamp.valueOf(now),
                orderId
        );

        return getMyOrders(user, 100).stream()
                .filter(o -> o.getOrderNumber().equalsIgnoreCase(orderNumber))
                .findFirst()
                .orElseThrow(() -> new BusinessException("Error retrieving updated order", HttpStatus.INTERNAL_SERVER_ERROR));
    }

    private void validateRequest(OrderCreateRequest request) {
        String orderSource = safe(request.getOrderSource()).toLowerCase(Locale.ROOT);
        if ("checkout-ui".equals(orderSource)) {
            List<String> missing = new ArrayList<>();
            if (!StringUtils.hasText(request.getCustomerFirstName())) missing.add("customerFirstName");
            if (!StringUtils.hasText(request.getCustomerLastName())) missing.add("customerLastName");
            if (!StringUtils.hasText(request.getCustomerPhone())) missing.add("customerPhone");
            if (!StringUtils.hasText(request.getShippingAddressLine1())) missing.add("shippingAddressLine1");
            if (!StringUtils.hasText(request.getShippingCity())) missing.add("shippingCity");
            if (!StringUtils.hasText(request.getShippingPostalCode())) missing.add("shippingPostalCode");
            if (!StringUtils.hasText(request.getShippingCountry())) missing.add("shippingCountry");
            if (!missing.isEmpty()) {
                throw new BusinessException("Missing required checkout fields: " + String.join(", ", missing), HttpStatus.BAD_REQUEST);
            }
        }
    }

    private InsertOrderResult insertOrder(OrderCreateRequest request,
                                          User user,
                                          String effectiveEmail,
                                          String orderNumber,
                                          String trackingSecret,
                                          BigDecimal subtotal,
                                          BigDecimal shippingFee,
                                          BigDecimal vat,
                                          BigDecimal discountAmount,
                                          int pointsRedeemed,
                                          BigDecimal pointsDiscountAmount,
                                          int pointsEarned,
                                          BigDecimal totalAmount,
                                          String currency) {
        KeyHolder keyHolder = new GeneratedKeyHolder();
        LocalDateTime now = LocalDateTime.now();

        jdbcTemplate.update(connection -> {
            PreparedStatement ps = connection.prepareStatement(
                    """
                            INSERT INTO orders (
                                order_number,
                                tracking_secret,
                                user_id,
                                customer_email,
                                customer_first_name,
                                customer_last_name,
                                customer_phone,
                                shipping_address_line1,
                                shipping_address_line2,
                                shipping_city,
                                shipping_state,
                                shipping_postal_code,
                                shipping_country,
                                delivery_latitude,
                                delivery_longitude,
                                delivery_location_label,
                                delivery_location_accuracy_meters,
                                delivery_location_captured_at,
                                notes,
                                subtotal,
                                shipping_fee,
                                vat,
                                discount_amount,
                                points_redeemed,
                                points_discount_amount,
                                points_earned,
                                total_amount,
                                currency,
                                coupon_code,
                                coupon_assignment_id,
                                payment_method,
                                payment_status,
                                order_status,
                                created_at,
                                updated_at
                            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', 'pending', ?, ?)
                            """,
                    new String[]{"id"}
            );
            ps.setString(1, orderNumber);
            ps.setString(2, trackingSecret);
            if (user == null || user.getId() == null) {
                ps.setNull(3, java.sql.Types.OTHER);
            } else {
                ps.setObject(3, user.getId());
            }
            ps.setString(4, effectiveEmail);
            ps.setString(5, nullable(request.getCustomerFirstName()));
            ps.setString(6, nullable(request.getCustomerLastName()));
            ps.setString(7, nullable(request.getCustomerPhone()));
            ps.setString(8, nullable(request.getShippingAddressLine1()));
            ps.setString(9, nullable(request.getShippingAddressLine2()));
            ps.setString(10, nullable(request.getShippingCity()));
            ps.setString(11, nullable(request.getShippingState()));
            ps.setString(12, nullable(request.getShippingPostalCode()));
            ps.setString(13, nullable(request.getShippingCountry()));
            ps.setObject(14, request.getDeliveryLatitude());
            ps.setObject(15, request.getDeliveryLongitude());
            ps.setString(16, nullable(request.getDeliveryLocationLabel()));
            ps.setObject(17, request.getDeliveryLocationAccuracyMeters());
            if (request.getDeliveryLocationCapturedAt() == null) {
                ps.setNull(18, java.sql.Types.BIGINT);
            } else {
                ps.setLong(18, request.getDeliveryLocationCapturedAt());
            }
            ps.setString(19, nullable(request.getNotes()));
            ps.setBigDecimal(20, subtotal);
            ps.setBigDecimal(21, shippingFee);
            ps.setBigDecimal(22, vat);
            ps.setBigDecimal(23, discountAmount);
            ps.setInt(24, pointsRedeemed);
            ps.setBigDecimal(25, pointsDiscountAmount);
            ps.setInt(26, pointsEarned);
            ps.setBigDecimal(27, totalAmount);
            ps.setString(28, currency);
            ps.setString(29, nullable(request.getCouponCode()));
            if (request.getCouponAssignmentId() == null) {
                ps.setNull(30, java.sql.Types.BIGINT);
            } else {
                ps.setLong(30, request.getCouponAssignmentId());
            }
            ps.setString(31, safe(request.getPaymentMethod()));
            ps.setTimestamp(32, Timestamp.valueOf(now));
            ps.setTimestamp(33, Timestamp.valueOf(now));
            return ps;
        }, keyHolder);

        Number key = keyHolder.getKey();
        if (key == null) {
            throw new BusinessException("Failed to create order", HttpStatus.INTERNAL_SERVER_ERROR);
        }
        return new InsertOrderResult(key.longValue(), trackingSecret);
    }

    private void insertOrderItems(Long orderId, List<OrderLine> lines) {
        LocalDateTime now = LocalDateTime.now();
        for (OrderLine line : lines) {
            jdbcTemplate.update(
                    """
                            INSERT INTO order_items (
                                order_id,
                                product_id,
                                product_name,
                                unit_price,
                                quantity,
                                line_total,
                                created_at,
                                updated_at
                            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                            """,
                    orderId,
                    line.product().getProductID(),
                    line.product().getProductName(),
                    line.unitPrice(),
                    line.quantity(),
                    line.lineTotal(),
                    Timestamp.valueOf(now),
                    Timestamp.valueOf(now)
            );
        }
    }

    private void insertPayment(Long orderId,
                               String orderNumber,
                               String paymentMethod,
                               BigDecimal totalAmount,
                               String currency,
                               String orderSource) {
        LocalDateTime now = LocalDateTime.now();
        String source = safe(orderSource).isBlank() ? "checkout-ui" : safe(orderSource);

        jdbcTemplate.update(
                """
                        INSERT INTO payments (
                            order_id,
                            payment_reference,
                            provider,
                            method,
                            amount,
                            currency,
                            status,
                            metadata,
                            created_at,
                            updated_at
                        ) VALUES (?, ?, 'manual', ?, ?, ?, 'pending', ?::jsonb, ?, ?)
                        """,
                orderId,
                orderNumber,
                paymentMethod,
                totalAmount,
                currency,
                "{\"source\":\"" + escapeJson(source) + "\"}",
                Timestamp.valueOf(now),
                Timestamp.valueOf(now)
        );
    }

    private void clearPurchasedCartItems(User user, List<OrderLine> lines) {
        if (user == null || lines.isEmpty()) {
            return;
        }

        try {
            Set<String> orderedProductIds = lines.stream()
                    .map(line -> line.product().getProductID())
                    .collect(Collectors.toSet());

            List<CartItem> cartItems = cartItemRepository.findByUser(user);
            if (cartItems.isEmpty()) {
                return;
            }

            cartItems.stream()
                    .filter(item -> orderedProductIds.contains(item.getProductID()))
                    .forEach(cartItemRepository::delete);
        } catch (Exception e) {
            // Cart cleanup is best-effort and must not fail order creation.
            log.warn("Skipping cart cleanup for user {} after order placement: {}",
                    user.getEmail(),
                    e.getMessage());
        }
    }

    private String generateOrderNumber() {
        String stamp = String.valueOf(System.currentTimeMillis());
        if (stamp.length() > 10) {
            stamp = stamp.substring(stamp.length() - 10);
        }
        String random = String.format("%04d", java.util.concurrent.ThreadLocalRandom.current().nextInt(10_000));
        return "ORD-" + stamp + "-" + random;
    }

    private BigDecimal money(double value) {
        return BigDecimal.valueOf(value).setScale(2, RoundingMode.HALF_UP);
    }

    private LoyaltyRedemption computeLoyaltyRedemption(OrderCreateRequest request, User user, BigDecimal prePointsTotal) {
        long requestedPoints = request.getPointsToRedeem() == null ? 0L : Math.max(0L, request.getPointsToRedeem());
        if (requestedPoints == 0L) {
            return new LoyaltyRedemption(0, BigDecimal.ZERO);
        }
        if (user == null || user.getId() == null) {
            throw new BusinessException("Sign in to redeem points", HttpStatus.BAD_REQUEST);
        }

        long availablePoints = Optional.ofNullable(
                jdbcTemplate.queryForObject("SELECT loyalty_points FROM users WHERE users_id = ?", Long.class, user.getId())
        ).orElse(0L);
        if (availablePoints <= 0L) {
            throw new BusinessException("No loyalty points available", HttpStatus.CONFLICT);
        }

        long maxRedeemableByRate = prePointsTotal
                .multiply(MAX_POINTS_DISCOUNT_RATE)
                .multiply(BigDecimal.valueOf(POINTS_PER_USD_DISCOUNT))
                .setScale(0, RoundingMode.FLOOR)
                .longValue();
        if (maxRedeemableByRate <= 0L) {
            throw new BusinessException("This order is too small for points redemption", HttpStatus.CONFLICT);
        }

        long effectivePoints = Math.min(requestedPoints, Math.min(availablePoints, maxRedeemableByRate));
        BigDecimal pointsDiscount = BigDecimal.valueOf(effectivePoints)
                .divide(BigDecimal.valueOf(POINTS_PER_USD_DISCOUNT), 2, RoundingMode.DOWN);
        return new LoyaltyRedemption(Math.toIntExact(effectivePoints), pointsDiscount);
    }

    private long applyLoyaltyChanges(User user, int pointsRedeemed, int pointsEarned) {
        if (user == null || user.getId() == null || (pointsRedeemed <= 0 && pointsEarned <= 0)) {
            return user != null && user.getLoyaltyPoints() != null ? user.getLoyaltyPoints() : 0L;
        }

        if (pointsRedeemed > 0) {
            int updated = jdbcTemplate.update(
                    "UPDATE users SET loyalty_points = loyalty_points - ?, updated_at = ? WHERE users_id = ? AND loyalty_points >= ?",
                    pointsRedeemed,
                    Timestamp.valueOf(LocalDateTime.now()),
                    user.getId(),
                    pointsRedeemed
            );
            if (updated == 0) {
                throw new BusinessException("Not enough loyalty points to redeem", HttpStatus.CONFLICT);
            }
        }

        if (pointsEarned > 0) {
            jdbcTemplate.update(
                    "UPDATE users SET loyalty_points = loyalty_points + ?, updated_at = ? WHERE users_id = ?",
                    pointsEarned,
                    Timestamp.valueOf(LocalDateTime.now()),
                    user.getId()
            );
        }

        User refreshed = userRepository.findById(user.getId())
                .orElseThrow(() -> new BusinessException("User not found", HttpStatus.NOT_FOUND));
        return refreshed.getLoyaltyPoints() == null ? 0L : refreshed.getLoyaltyPoints();
    }

    private String normalizeEmail(String value) {
        return safe(value).toLowerCase(Locale.ROOT);
    }

    private boolean isValidEmail(String value) {
        return value.matches("^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$");
    }

    private String nullable(String value) {
        String trimmed = safe(value);
        return trimmed.isBlank() ? null : trimmed;
    }

    private String safe(String value) {
        return value == null ? "" : value.trim();
    }

    private String escapeJson(String value) {
        return safe(value).replace("\\", "\\\\").replace("\"", "\\\"");
    }

    private boolean hasFulfillmentStaffRole(User user) {
        return hasAdminOrEmployeeRole(user) || hasRole(user, "ROLE_SHIPPER");
    }

    private boolean hasAdminOrEmployeeRole(User user) {
        return hasRole(user, "ROLE_ADMIN") || hasRole(user, "ROLE_EMPLOYEE");
    }

    private boolean hasRole(User user, String expected) {
        if (user == null || user.getAuthorities() == null) {
            return false;
        }
        for (var authority : user.getAuthorities()) {
            if (expected.equals(authority.getAuthority())) {
                return true;
            }
        }
        return false;
    }

    private List<OrderHistoryItemDto> queryRecentStaffWideOrderHistory(int safeLimit) {
        return jdbcTemplate.query(
                """
                        SELECT o.id,
                               o.order_number,
                               MAX(o.tracking_secret) AS tracking_secret,
                               o.customer_email,
                               o.customer_first_name,
                               o.customer_last_name,
                               o.total_amount,
                               o.currency,
                               o.payment_method,
                               o.payment_status,
                               o.order_status,
                               o.created_at,
                               o.updated_at,
                               o.shipping_carrier,
                               o.shipping_tracking_public,
                               o.shipped_at,
                               COALESCE(SUM(oi.quantity), 0) AS item_count
                        FROM orders o
                        LEFT JOIN order_items oi ON oi.order_id = o.id
                        GROUP BY o.id
                        ORDER BY o.created_at DESC
                        LIMIT ?
                """,
                (rs, rowNum) -> mapOrderHistoryRow(rs),
                safeLimit
        );
    }

    private OrderHistoryItemDto mapOrderHistoryRow(ResultSet rs) throws SQLException {
        return OrderHistoryItemDto.builder()
                .id(rs.getLong("id"))
                .orderNumber(rs.getString("order_number"))
                .trackingSecret(rs.getString("tracking_secret"))
                .customerEmail(rs.getString("customer_email"))
                .customerFirstName(rs.getString("customer_first_name"))
                .customerLastName(rs.getString("customer_last_name"))
                .totalAmount(rs.getBigDecimal("total_amount"))
                .currency(rs.getString("currency"))
                .paymentMethod(rs.getString("payment_method"))
                .paymentStatus(rs.getString("payment_status"))
                .orderStatus(rs.getString("order_status"))
                .itemCount(rs.getInt("item_count"))
                .createdAt(toLocalDateTime(rs.getTimestamp("created_at")))
                .updatedAt(toLocalDateTime(rs.getTimestamp("updated_at")))
                .shippingCarrier(rs.getString("shipping_carrier"))
                .shippingTrackingPublic(rs.getString("shipping_tracking_public"))
                .shippedAt(toLocalDateTime(rs.getTimestamp("shipped_at")))
                .build();
    }

    @Override
    @Transactional(readOnly = true)
    public Map<String, Long> fulfillmentInsightsForStaff() {
        Long readyToShip = Optional.ofNullable(
                jdbcTemplate.queryForObject(
                        """
                                SELECT COUNT(*) FROM orders
                                WHERE LOWER(order_status) NOT IN ('shipped', 'completed', 'cancelled')
                                  AND (
                                    (LOWER(payment_status) = 'paid' AND LOWER(order_status) IN ('paid', 'processing'))
                                    OR (
                                        (LOWER(TRIM(payment_method)) LIKE '%cash%delivery%' OR LOWER(TRIM(payment_method)) = 'cod')
                                        AND LOWER(payment_status) IN ('pending', 'authorized')
                                        AND LOWER(order_status) IN ('pending', 'processing'))
                                  )
                                """,
                        Long.class
                )
        ).orElse(0L);

        Long shippedLast7Days = Optional.ofNullable(
                jdbcTemplate.queryForObject(
                        """
                                SELECT COUNT(*) FROM orders
                                WHERE LOWER(order_status) = 'shipped'
                                    AND COALESCE(shipped_at, updated_at)
                                        >= CURRENT_TIMESTAMP - INTERVAL '7 days'
                                """,
                        Long.class
                )
        ).orElse(0L);

        Long pendingCheckout = Optional.ofNullable(
                jdbcTemplate.queryForObject(
                        "SELECT COUNT(*) FROM orders WHERE LOWER(order_status) = 'pending'",
                        Long.class
                )
        ).orElse(0L);

        return Map.of(
                "readyToShip", readyToShip,
                "shippedLast7Days", shippedLast7Days,
                "pendingCheckoutOrders", pendingCheckout
        );
    }

    private LocalDateTime toLocalDateTime(Timestamp timestamp) {
        return timestamp == null ? null : timestamp.toLocalDateTime();
    }

    private record InsertOrderResult(long id, String trackingSecret) {
    }

    private record OrderLine(Product product, int quantity, BigDecimal unitPrice, BigDecimal lineTotal) {
    }

    private record LoyaltyRedemption(int pointsRedeemed, BigDecimal discountAmount) {
    }
}
