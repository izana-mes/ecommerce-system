package com.example.shop.modules.inventory.service;

import com.example.shop.common.exception.BusinessException;
import com.example.shop.config.CacheInvalidationEventPublisher;
import com.example.shop.modules.inventory.dto.InventoryReservationDtos;
import com.example.shop.modules.inventory.entity.*;
import com.example.shop.modules.inventory.messaging.InventoryReservationEvent;
import com.example.shop.modules.inventory.messaging.InventoryReservationEventPublisher;
import com.example.shop.modules.inventory.repository.*;
import com.example.shop.modules.product.entity.Product;
import com.example.shop.modules.product.repository.ProductRepository;
import com.example.shop.modules.user.entity.User;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.cache.Cache;
import org.springframework.cache.CacheManager;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.script.DefaultRedisScript;
import org.springframework.http.HttpStatus;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.*;
import java.util.function.Supplier;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class InventoryReservationServiceImpl implements InventoryReservationService {

    private final InventoryRepository inventoryRepository;
    private final InventoryReservationRepository inventoryReservationRepository;
    private final InventoryReservationItemRepository inventoryReservationItemRepository;
    private final InventoryTransactionRepository inventoryTransactionRepository;
    private final ProductRepository productRepository;
    private final StringRedisTemplate redisTemplate;
    private final InventoryReservationEventPublisher inventoryReservationEventPublisher;
    private final JdbcTemplate jdbcTemplate;
    private final CacheManager cacheManager;
    private final CacheInvalidationEventPublisher cacheInvalidationEventPublisher;

    private static final int DEFAULT_TTL_MINUTES = 5 * 60;
    private static final int MAX_TTL_MINUTES = 5 * 60;
    private static final int DEFAULT_STOCK_QUANTITY = 25;
    private static final DefaultRedisScript<Long> LOCK_RELEASE_SCRIPT = new DefaultRedisScript<>(
            "if redis.call('GET', KEYS[1]) == ARGV[1] then return redis.call('DEL', KEYS[1]) else return 0 end",
            Long.class
    );

    @Value("${application.inventory.redis-lock.ttl-seconds:15}")
    private long lockTtlSeconds;

    @Override
    @Transactional
    public InventoryReservationDtos.ReservationResponse reserve(InventoryReservationDtos.ReserveRequest request, User user) {
        String orderNumber = request == null ? "" : String.valueOf(request.getOrderNumber()).trim();
        String lockKey = "inv:lock:reserve:" + (orderNumber.isBlank() ? "unknown-order" : orderNumber);
        return withRedisLock(lockKey, () -> reserveInternal(request, user));
    }

    private InventoryReservationDtos.ReservationResponse reserveInternal(InventoryReservationDtos.ReserveRequest request, User user) {
        int ttlMinutes = normalizeTtl(request.getTtlMinutes());
        LocalDateTime now = LocalDateTime.now();
        LocalDateTime expiresAt = now.plusMinutes(ttlMinutes);
        String reservationCode = "RSV-" + UUID.randomUUID().toString().replace("-", "").substring(0, 16).toUpperCase(Locale.ROOT);

        Map<ReservationKey, Integer> qtyByProduct = request.getItems().stream()
                .collect(Collectors.toMap(i -> new ReservationKey(i.getProductId().trim(), i.getSupplierOfferId(), i.getSellerListingId()), InventoryReservationDtos.Item::getQuantity, Integer::sum, LinkedHashMap::new));

        List<String> productIds = qtyByProduct.keySet().stream().map(ReservationKey::productId).distinct().toList();
        ensureProductsExist(productIds);

        for (Map.Entry<ReservationKey, Integer> entry : qtyByProduct.entrySet()) {
            String productId = entry.getKey().productId();
            int qty = entry.getValue();

            UUID offerId = entry.getKey().supplierOfferId();
            UUID listingId = entry.getKey().sellerListingId();
            if (listingId != null) {
                int changed = jdbcTemplate.update("UPDATE seller_product_allocations a SET reserved_quantity = a.reserved_quantity + ?, updated_at = CURRENT_TIMESTAMP WHERE a.listing_id = ? AND a.supplier_offer_id = ? AND a.status = 'ACTIVE' AND a.allocated_quantity - a.sold_quantity - a.reserved_quantity >= ? AND EXISTS (SELECT 1 FROM seller_product_listings l JOIN seller_resale_authorizations z ON z.id=l.authorization_id WHERE l.id=a.listing_id AND l.supplier_product_id=? AND l.active=TRUE AND z.is_active=TRUE)", qty, listingId, offerId, qty, productId);
                if (changed != 1) throw new BusinessException("Seller allocation unavailable or insufficient", HttpStatus.CONFLICT);
                continue;
            }
            if (offerId != null) {
                int changed = jdbcTemplate.update("UPDATE supplier_products sp SET reserved_quantity = sp.reserved_quantity + ?, updated_at = CURRENT_TIMESTAMP WHERE sp.id = ? AND sp.product_id = ? AND sp.approved = TRUE AND sp.available = TRUE AND sp.stock_quantity - sp.reserved_quantity - COALESCE((SELECT SUM(a.allocated_quantity-a.sold_quantity) FROM seller_product_allocations a WHERE a.supplier_offer_id=sp.id),0) - COALESCE((SELECT SUM(z.initial_allocation_quantity) FROM seller_resale_authorizations z WHERE z.supplier_offer_id=sp.id AND z.is_active=TRUE AND NOT EXISTS(SELECT 1 FROM seller_product_listings l WHERE l.authorization_id=z.id)),0) >= ? AND ? >= sp.minimum_order_quantity", qty, offerId, productId, qty, qty);
                if (changed != 1) throw new BusinessException("Supplier offer unavailable, out of stock, or below MOQ", HttpStatus.CONFLICT);
                continue;
            }

            Inventory inventory = lockOrCreateInventory(productId);
            int beforeAvailable = nz(inventory.getAvailableStock());
            int beforeReserved = nz(inventory.getReservedStock());
            if (beforeAvailable < qty) {
                throw new BusinessException("Insufficient stock for product " + productId, HttpStatus.CONFLICT);
            }

            inventory.setAvailableStock(beforeAvailable - qty);
            inventory.setReservedStock(beforeReserved + qty);
            inventory.setUpdatedAt(now);
            inventoryRepository.save(inventory);

            saveTx(productId, reservationCode, request.getOrderNumber(), "RESERVE", qty,
                    beforeAvailable, beforeAvailable - qty, beforeReserved, beforeReserved + qty, now, Map.of());
        }

        InventoryReservation reservation = InventoryReservation.builder()
                .reservationCode(reservationCode)
                .orderNumber(request.getOrderNumber().trim())
                .userId(user == null ? null : user.getId())
                .status(InventoryReservationStatus.ACTIVE)
                .expiresAt(expiresAt)
                .createdAt(now)
                .updatedAt(now)
                .build();
        reservation = inventoryReservationRepository.save(reservation);

        for (Map.Entry<ReservationKey, Integer> entry : qtyByProduct.entrySet()) {
            UUID offerId = entry.getKey().supplierOfferId();
            inventoryReservationItemRepository.save(InventoryReservationItem.builder()
                    .reservation(reservation)
                    .productId(entry.getKey().productId())
                    .supplierOffer(offerId == null ? null : com.example.shop.modules.resale.entity.SupplierProduct.builder().id(offerId).build())
                    .sellerListingId(entry.getKey().sellerListingId())
                    .quantity(entry.getValue())
                    .build());
        }

        // Decrement product-facing stockQuantity at reservation time so remaining stock
        // visible to customers reflects the reservation immediately.
        try {
            List<Product> products = productRepository.findByProductIDIn(productIds);
            Map<String, Product> productsMap = products.stream().collect(Collectors.toMap(Product::getProductID, p -> p));
            for (Map.Entry<ReservationKey, Integer> entry : qtyByProduct.entrySet()) {
                if (entry.getKey().supplierOfferId() != null) continue;
                Product p = productsMap.get(entry.getKey().productId());
                if (p != null) {
                    int newStock = Math.max(0, defaultStock(p.getStockQuantity()) - entry.getValue());
                    p.setStockQuantity(newStock);
                }
            }
            if (!products.isEmpty()) {
                productRepository.saveAll(products);
                evictProductCaches();
            }
        } catch (Exception ex) {
            log.warn("Failed to update product.stockQuantity on reservation {}: {}", reservationCode, ex.getMessage());
        }

        String redisKey = reservationKey(reservationCode);
        try {
            redisTemplate.opsForValue().set(redisKey, "ACTIVE", Duration.ofMinutes(ttlMinutes));
        } catch (Exception ex) {
            log.warn("Redis unavailable for reservation {} ttl mirror: {}", reservationCode, ex.getMessage());
        }
        inventoryReservationEventPublisher.publishReserved(InventoryReservationEvent.builder()
                .eventType("inventory.reserved")
                .reservationCode(reservationCode)
                .orderNumber(reservation.getOrderNumber())
                .status(reservation.getStatus().name())
                .occurredAt(now)
                .build());

        return toResponse(reservation);
    }

    @Override
    @Transactional
    public InventoryReservationDtos.ReservationResponse confirm(String reservationCode) {
        String lockKey = "inv:lock:reservation:" + (reservationCode == null ? "unknown" : reservationCode.trim());
        return withRedisLock(lockKey, () -> confirmInternal(reservationCode));
    }

    private InventoryReservationDtos.ReservationResponse confirmInternal(String reservationCode) {
        InventoryReservation reservation = findReservationOrThrow(reservationCode);
        if (reservation.getStatus() != InventoryReservationStatus.ACTIVE) {
            return toResponse(reservation);
        }

        LocalDateTime now = LocalDateTime.now();

        // Adjust inventory reserved -> confirmed (move out of reserved) and decrement product stockQuantity
        List<InventoryReservationItem> items = inventoryReservationItemRepository.findByReservation(reservation);
        if (items != null && !items.isEmpty()) {
            // Update inventory rows and record transactions (product.stockQuantity
            // already adjusted at reservation time)
            for (InventoryReservationItem item : items) {
                String productId = item.getProductId();
                int qty = item.getQuantity();

                if (item.getSupplierOffer() != null) {
                    if (item.getSellerListingId() != null) {
                        int stockChanged = jdbcTemplate.update("UPDATE supplier_products SET stock_quantity = stock_quantity - ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND stock_quantity >= ?", qty, item.getSupplierOffer().getId(), qty);
                        if (stockChanged != 1) throw new BusinessException("Supplier inventory is inconsistent with Seller allocation", HttpStatus.CONFLICT);
                        int changed = jdbcTemplate.update("UPDATE seller_product_allocations SET reserved_quantity = reserved_quantity - ?, sold_quantity = sold_quantity + ?, updated_at = CURRENT_TIMESTAMP WHERE listing_id = ? AND reserved_quantity >= ?", qty, qty, item.getSellerListingId(), qty);
                        if (changed != 1) throw new BusinessException("Seller allocation reservation is inconsistent", HttpStatus.CONFLICT);
                        continue;
                    }
                    int changed = jdbcTemplate.update("UPDATE supplier_products SET reserved_quantity = reserved_quantity - ?, stock_quantity = stock_quantity - ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND reserved_quantity >= ? AND stock_quantity >= ?", qty, qty, item.getSupplierOffer().getId(), qty, qty);
                    if (changed != 1) throw new BusinessException("Supplier offer reservation is inconsistent", HttpStatus.CONFLICT);
                    continue;
                }

                Inventory inventory = lockOrCreateInventory(productId);
                int beforeAvailable = nz(inventory.getAvailableStock());
                int beforeReserved = nz(inventory.getReservedStock());
                if (beforeReserved < qty) {
                    throw new BusinessException("Corrupted reserved stock for product " + productId, HttpStatus.CONFLICT);
                }

                inventory.setReservedStock(beforeReserved - qty);
                inventory.setPackedStock(nz(inventory.getPackedStock()) + qty);
                inventory.setUpdatedAt(now);
                inventoryRepository.save(inventory);

                saveTx(productId, reservation.getReservationCode(), reservation.getOrderNumber(), "CONFIRM",
                        qty,
                        beforeAvailable, beforeAvailable, beforeReserved, beforeReserved - qty, now, Map.of());
            }

        }

        reservation.setStatus(InventoryReservationStatus.CONFIRMED);
        reservation.setUpdatedAt(now);
        inventoryReservationRepository.save(reservation);
        safeDeleteRedisMirror(reservationCode);
        inventoryReservationEventPublisher.publishReserved(InventoryReservationEvent.builder()
                .eventType("inventory.confirmed")
                .reservationCode(reservation.getReservationCode())
                .orderNumber(reservation.getOrderNumber())
                .status(reservation.getStatus().name())
                .occurredAt(now)
                .build());

        return toResponse(reservation);
    }

    @Override
    @Transactional
    public InventoryReservationDtos.ReservationResponse release(String reservationCode, String reason) {
        String lockKey = "inv:lock:reservation:" + (reservationCode == null ? "unknown" : reservationCode.trim());
        return withRedisLock(lockKey, () -> releaseInternalEntry(reservationCode, reason));
    }

    private InventoryReservationDtos.ReservationResponse releaseInternalEntry(String reservationCode, String reason) {
        InventoryReservation reservation = findReservationOrThrow(reservationCode);
        if (reservation.getStatus() != InventoryReservationStatus.ACTIVE
                && reservation.getStatus() != InventoryReservationStatus.CONFIRMED) {
            return toResponse(reservation);
        }
        releaseInternal(reservation, reason == null ? "manual_release" : reason, InventoryReservationStatus.RELEASED);
        return toResponse(reservation);
    }

    @Override
    @Transactional
    public InventoryReservationDtos.ReservationResponse confirmByOrderNumber(String orderNumber) {
        InventoryReservation reservation = inventoryReservationRepository.findTopByOrderNumberOrderByIdDesc(orderNumber)
                .orElseThrow(() -> new BusinessException("Reservation not found for order", HttpStatus.NOT_FOUND));
        return confirm(reservation.getReservationCode());
    }

    @Override
    @Transactional
    public InventoryReservationDtos.ReservationResponse releaseByOrderNumber(String orderNumber, String reason) {
        InventoryReservation reservation = inventoryReservationRepository.findTopByOrderNumberOrderByIdDesc(orderNumber)
                .orElseThrow(() -> new BusinessException("Reservation not found for order", HttpStatus.NOT_FOUND));
        return release(reservation.getReservationCode(), reason);
    }

    @Override
    @Transactional
    public int expireReservations() {
        List<InventoryReservation> expired = inventoryReservationRepository
                .findTop200ByStatusAndExpiresAtBeforeOrderByExpiresAtAsc(InventoryReservationStatus.ACTIVE, LocalDateTime.now());

        for (InventoryReservation reservation : expired) {
            releaseInternal(reservation, "payment_timeout", InventoryReservationStatus.EXPIRED);
        }
        return expired.size();
    }

    @Scheduled(fixedDelayString = "${application.inventory.reservation.expire-fixed-delay-ms:5000}")
    @Transactional
    public void runExpiry() {
        int count = expireReservations();
        if (count > 0) {
            log.info("Expired {} inventory reservation(s)", count);
        }
    }

    private void releaseInternal(InventoryReservation reservation, String reason, InventoryReservationStatus targetStatus) {
        LocalDateTime now = LocalDateTime.now();
        List<InventoryReservationItem> items = inventoryReservationItemRepository.findByReservation(reservation);
        if (items != null && !items.isEmpty()) {
            // If reservation was ACTIVE -> move reserved -> available
            // If reservation was CONFIRMED -> move packed -> available and restore product.stockQuantity
            boolean wasConfirmed = reservation.getStatus() == InventoryReservationStatus.CONFIRMED;

            List<String> productIds = items.stream().map(InventoryReservationItem::getProductId).toList();
            Map<String, Product> products = productRepository.findByProductIDIn(productIds)
                    .stream().collect(Collectors.toMap(Product::getProductID, p -> p));

            for (InventoryReservationItem item : items) {
                if (item.getSupplierOffer() != null) {
                    if (item.getSellerListingId() != null) {
                        if (wasConfirmed) {
                            int stockChanged = jdbcTemplate.update("UPDATE supplier_products SET stock_quantity = stock_quantity + ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?", item.getQuantity(), item.getSupplierOffer().getId());
                            if (stockChanged != 1) throw new BusinessException("Supplier inventory could not be restored", HttpStatus.CONFLICT);
                            int changed = jdbcTemplate.update("UPDATE seller_product_allocations SET sold_quantity = sold_quantity - ?, updated_at = CURRENT_TIMESTAMP WHERE listing_id = ? AND sold_quantity >= ?", item.getQuantity(), item.getSellerListingId(), item.getQuantity());
                            if (changed != 1) throw new BusinessException("Seller allocation sold quantity is inconsistent", HttpStatus.CONFLICT);
                        } else {
                            int changed = jdbcTemplate.update("UPDATE seller_product_allocations SET reserved_quantity = reserved_quantity - ?, updated_at = CURRENT_TIMESTAMP WHERE listing_id = ? AND reserved_quantity >= ?", item.getQuantity(), item.getSellerListingId(), item.getQuantity());
                            if (changed != 1) throw new BusinessException("Seller allocation reservation is inconsistent", HttpStatus.CONFLICT);
                        }
                        continue;
                    }
                    if (wasConfirmed) {
                        jdbcTemplate.update("UPDATE supplier_products SET stock_quantity = stock_quantity + ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?", item.getQuantity(), item.getSupplierOffer().getId());
                    } else {
                        int changed = jdbcTemplate.update("UPDATE supplier_products SET reserved_quantity = reserved_quantity - ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND reserved_quantity >= ?", item.getQuantity(), item.getSupplierOffer().getId(), item.getQuantity());
                        if (changed != 1) throw new BusinessException("Supplier offer reservation is inconsistent", HttpStatus.CONFLICT);
                    }
                    continue;
                }
                Inventory inventory = lockOrCreateInventory(item.getProductId());
                int qty = item.getQuantity();

                if (!wasConfirmed) {
                    int beforeAvailable = nz(inventory.getAvailableStock());
                    int beforeReserved = nz(inventory.getReservedStock());
                    if (beforeReserved < qty) {
                        throw new BusinessException("Corrupted reserved stock for product " + item.getProductId(), HttpStatus.CONFLICT);
                    }

                    inventory.setReservedStock(beforeReserved - qty);
                    inventory.setAvailableStock(beforeAvailable + qty);
                    inventory.setUpdatedAt(now);
                    inventoryRepository.save(inventory);

                    saveTx(item.getProductId(), reservation.getReservationCode(), reservation.getOrderNumber(),
                            targetStatus == InventoryReservationStatus.EXPIRED ? "EXPIRE_RELEASE" : "MANUAL_RELEASE",
                            qty,
                            beforeAvailable, beforeAvailable + qty, beforeReserved, beforeReserved - qty, now,
                            Map.of("reason", reason));
                    // Restore product-facing stockQuantity (was decremented at reservation time)
                    Product pRest = products.get(item.getProductId());
                    if (pRest != null) {
                        int restored = defaultStock(pRest.getStockQuantity()) + qty;
                        pRest.setStockQuantity(restored);
                    }
                } else {
                    int beforeAvailable = nz(inventory.getAvailableStock());
                    int beforePacked = nz(inventory.getPackedStock());
                    if (beforePacked < qty) {
                        throw new BusinessException("Corrupted packed stock for product " + item.getProductId(), HttpStatus.CONFLICT);
                    }

                    inventory.setPackedStock(beforePacked - qty);
                    inventory.setAvailableStock(beforeAvailable + qty);
                    inventory.setUpdatedAt(now);
                    inventoryRepository.save(inventory);

                    saveTx(item.getProductId(), reservation.getReservationCode(), reservation.getOrderNumber(),
                            "CONFIRMED_RELEASE",
                            qty,
                            beforeAvailable, beforeAvailable + qty, beforePacked, beforePacked - qty, now,
                            Map.of("reason", reason));

                    // Restore product-facing stockQuantity
                    Product p = products.get(item.getProductId());
                    if (p != null) {
                        int restored = defaultStock(p.getStockQuantity()) + qty;
                        p.setStockQuantity(restored);
                    }
                }
            }

            // Persist product stock updates if any
            List<Product> toSave = products.values().stream().toList();
            if (!toSave.isEmpty()) {
                productRepository.saveAll(toSave);
                evictProductCaches();
            }
        }

        reservation.setStatus(targetStatus);
        reservation.setReleaseReason(reason);
        reservation.setReleasedAt(now);
        reservation.setUpdatedAt(now);
        inventoryReservationRepository.save(reservation);
        autoCancelPendingOrderOnExpiry(reservation, now, targetStatus);
        safeDeleteRedisMirror(reservation.getReservationCode());
        inventoryReservationEventPublisher.publishReleased(InventoryReservationEvent.builder()
                .eventType("inventory.released")
                .reservationCode(reservation.getReservationCode())
                .orderNumber(reservation.getOrderNumber())
                .status(reservation.getStatus().name())
                .occurredAt(now)
                .build());
    }

    private Inventory lockOrCreateInventory(String productId) {
        return inventoryRepository.findByProductId(productId)
                .orElseGet(() -> {
                    Product p = productRepository.findByProductID(productId)
                            .orElseThrow(() -> new BusinessException("Product not found: " + productId, HttpStatus.NOT_FOUND));
                    LocalDateTime now = LocalDateTime.now();
                    return inventoryRepository.save(Inventory.builder()
                            .productId(productId)
                            .availableStock(Math.max(0, nz(p.getStockQuantity())))
                            .reservedStock(0)
                            .packedStock(0)
                            .inTransitStock(0)
                            .returnedStock(0)
                            .damagedStock(0)
                            .createdAt(now)
                            .updatedAt(now)
                            .build());
                });
    }

    private void ensureProductsExist(List<String> productIds) {
        Map<String, Product> map = productRepository.findByProductIDIn(productIds).stream()
                .collect(Collectors.toMap(Product::getProductID, p -> p));
        for (String productId : productIds) {
            Product p = map.get(productId);
            if (p == null || Boolean.FALSE.equals(p.getActive())) {
                throw new BusinessException("Product is unavailable: " + productId, HttpStatus.CONFLICT);
            }
        }
    }

    private InventoryReservation findReservationOrThrow(String reservationCode) {
        return inventoryReservationRepository.findByReservationCode(reservationCode)
                .orElseThrow(() -> new BusinessException("Reservation not found", HttpStatus.NOT_FOUND));
    }

    private void safeDeleteRedisMirror(String reservationCode) {
        try {
            redisTemplate.delete(reservationKey(reservationCode));
        } catch (Exception ex) {
            log.warn("Redis delete failed for reservation {}: {}", reservationCode, ex.getMessage());
        }
    }

    private void saveTx(String productId,
                        String reservationCode,
                        String orderNumber,
                        String type,
                        int qty,
                        int beforeAvailable,
                        int afterAvailable,
                        int beforeReserved,
                        int afterReserved,
                        LocalDateTime at,
                        Map<String, Object> metadata) {
        inventoryTransactionRepository.save(InventoryTransaction.builder()
                .productId(productId)
                .reservationCode(reservationCode)
                .orderNumber(orderNumber)
                .transactionType(type)
                .quantity(qty)
                .beforeAvailableStock(beforeAvailable)
                .afterAvailableStock(afterAvailable)
                .beforeReservedStock(beforeReserved)
                .afterReservedStock(afterReserved)
                .metadata(metadata)
                .createdAt(at)
                .build());
    }

    private void evictProductCaches() {
        try {
            List<String> caches = List.of(
                    com.example.shop.config.RedisCacheConfig.PRODUCTS_ALL,
                    com.example.shop.config.RedisCacheConfig.PRODUCTS_ACTIVE,
                    com.example.shop.config.RedisCacheConfig.PRODUCTS_SEARCH,
                    com.example.shop.config.RedisCacheConfig.PRODUCTS_SUGGEST,
                    com.example.shop.config.RedisCacheConfig.PRODUCTS_INVENTORY_HEALTH,
                    com.example.shop.config.RedisCacheConfig.ADMIN_DASHBOARD,
                    com.example.shop.config.RedisCacheConfig.STAFF_DASHBOARD,
                    com.example.shop.config.RedisCacheConfig.SELLER_DASHBOARD,
                    com.example.shop.config.RedisCacheConfig.SUPPLIER_DASHBOARD
            );
            for (String c : caches) {
                try {
                    Cache cache = cacheManager.getCache(c);
                    if (cache != null) {
                        cache.clear();
                    }
                } catch (Exception inner) {
                    log.warn("Failed to clear cache {}: {}", c, inner.getMessage());
                }
            }
            cacheInvalidationEventPublisher.publish(caches);
        } catch (Exception ex) {
            log.warn("Failed to evict product caches: {}", ex.getMessage());
        }
    }

    private InventoryReservationDtos.ReservationResponse toResponse(InventoryReservation reservation) {
        InventoryReservationDtos.ReservationResponse response = new InventoryReservationDtos.ReservationResponse();
        response.setReservationCode(reservation.getReservationCode());
        response.setOrderNumber(reservation.getOrderNumber());
        response.setStatus(reservation.getStatus().name());
        response.setExpiresAt(reservation.getExpiresAt());
        return response;
    }

    private String reservationKey(String reservationCode) {
        return "inv:reservation:" + reservationCode;
    }

    private int normalizeTtl(Integer ttlMinutes) {
        if (ttlMinutes == null || ttlMinutes <= 0) {
            return DEFAULT_TTL_MINUTES;
        }
        return Math.min(ttlMinutes, MAX_TTL_MINUTES);
    }

    private void autoCancelPendingOrderOnExpiry(InventoryReservation reservation,
                                                LocalDateTime now,
                                                InventoryReservationStatus targetStatus) {
        if (targetStatus != InventoryReservationStatus.EXPIRED) {
            return;
        }

        String orderNumber = reservation.getOrderNumber();
        if (orderNumber == null || orderNumber.isBlank()) {
            return;
        }

        int orderUpdated = jdbcTemplate.update(
                """
                UPDATE orders
                SET order_status = 'cancelled',
                    payment_status = 'cancelled',
                    updated_at = ?
                WHERE order_number = ?
                  AND LOWER(order_status) = 'pending'
                  AND LOWER(payment_status) = 'pending'
                """,
                now,
                orderNumber
        );

        if (orderUpdated <= 0) {
            return;
        }

        jdbcTemplate.update(
                """
                UPDATE payments
                SET status = 'cancelled',
                    updated_at = ?
                WHERE order_id IN (SELECT id FROM orders WHERE order_number = ?)
                  AND LOWER(status) = 'pending'
                """,
                now,
                orderNumber
        );
        log.info("Auto-cancelled pending unpaid order {} after reservation expiry", orderNumber);
    }

    private int nz(Integer value) {
        return value == null ? 0 : value;
    }

    private int defaultStock(Integer value) {
        if (value == null) return DEFAULT_STOCK_QUANTITY;
        return Math.max(0, value);
    }

    private <T> T withRedisLock(String lockKey, Supplier<T> action) {
        String token = UUID.randomUUID().toString();
        Duration ttl = Duration.ofSeconds(Math.max(5, lockTtlSeconds));
        boolean acquired = false;
        boolean bypassLock = false;
        try {
            try {
                Boolean ok = redisTemplate.opsForValue().setIfAbsent(lockKey, token, ttl);
                acquired = Boolean.TRUE.equals(ok);
            } catch (Exception ex) {
                bypassLock = true;
                log.warn("Redis lock unavailable for key {}: {}. Continuing without distributed lock.", lockKey, ex.getMessage());
            }
            if (!acquired && !bypassLock) {
                throw new BusinessException("Inventory operation is busy. Please retry.", HttpStatus.CONFLICT);
            }
            return action.get();
        } finally {
            if (acquired) {
                try {
                    redisTemplate.execute(LOCK_RELEASE_SCRIPT, List.of(lockKey), token);
                } catch (Exception ex) {
                    log.warn("Failed to release redis lock {}: {}", lockKey, ex.getMessage());
                }
            }
        }
    }

    private record ReservationKey(String productId, UUID supplierOfferId, UUID sellerListingId) { }
}
