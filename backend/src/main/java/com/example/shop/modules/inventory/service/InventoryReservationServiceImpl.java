package com.example.shop.modules.inventory.service;

import com.example.shop.common.exception.BusinessException;
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
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.http.HttpStatus;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.*;
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

    private static final int DEFAULT_TTL_MINUTES = 5 * 60;
    private static final int MAX_TTL_MINUTES = 5 * 60;

    @Override
    @Transactional
    public InventoryReservationDtos.ReservationResponse reserve(InventoryReservationDtos.ReserveRequest request, User user) {
        int ttlMinutes = normalizeTtl(request.getTtlMinutes());
        LocalDateTime now = LocalDateTime.now();
        LocalDateTime expiresAt = now.plusMinutes(ttlMinutes);
        String reservationCode = "RSV-" + UUID.randomUUID().toString().replace("-", "").substring(0, 16).toUpperCase(Locale.ROOT);

        Map<String, Integer> qtyByProduct = request.getItems().stream()
                .collect(Collectors.toMap(i -> i.getProductId().trim(), InventoryReservationDtos.Item::getQuantity, Integer::sum, LinkedHashMap::new));

        List<String> productIds = new ArrayList<>(qtyByProduct.keySet());
        ensureProductsExist(productIds);

        for (Map.Entry<String, Integer> entry : qtyByProduct.entrySet()) {
            String productId = entry.getKey();
            int qty = entry.getValue();

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

        for (Map.Entry<String, Integer> entry : qtyByProduct.entrySet()) {
            inventoryReservationItemRepository.save(InventoryReservationItem.builder()
                    .reservation(reservation)
                    .productId(entry.getKey())
                    .quantity(entry.getValue())
                    .build());
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
        InventoryReservation reservation = findReservationOrThrow(reservationCode);
        if (reservation.getStatus() != InventoryReservationStatus.ACTIVE) {
            return toResponse(reservation);
        }

        reservation.setStatus(InventoryReservationStatus.CONFIRMED);
        reservation.setUpdatedAt(LocalDateTime.now());
        inventoryReservationRepository.save(reservation);
        safeDeleteRedisMirror(reservationCode);
        return toResponse(reservation);
    }

    @Override
    @Transactional
    public InventoryReservationDtos.ReservationResponse release(String reservationCode, String reason) {
        InventoryReservation reservation = findReservationOrThrow(reservationCode);
        if (reservation.getStatus() != InventoryReservationStatus.ACTIVE) {
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
    public void runExpiry() {
        int count = expireReservations();
        if (count > 0) {
            log.info("Expired {} inventory reservation(s)", count);
        }
    }

    private void releaseInternal(InventoryReservation reservation, String reason, InventoryReservationStatus targetStatus) {
        LocalDateTime now = LocalDateTime.now();
        List<InventoryReservationItem> items = inventoryReservationItemRepository.findByReservation(reservation);

        for (InventoryReservationItem item : items) {
            Inventory inventory = lockOrCreateInventory(item.getProductId());
            int qty = item.getQuantity();
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
}
