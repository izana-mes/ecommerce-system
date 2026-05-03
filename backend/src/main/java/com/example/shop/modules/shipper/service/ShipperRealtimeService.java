package com.example.shop.modules.shipper.service;

import com.example.shop.common.exception.BusinessException;
import com.example.shop.modules.shipper.dto.ShipperDtos;
import com.example.shop.modules.shipper.entity.*;
import com.example.shop.modules.shipper.repository.*;
import com.example.shop.modules.user.entity.User;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.http.HttpStatus;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Locale;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class ShipperRealtimeService {

    private static final String LOCATION_KEY_PREFIX = "shipper:location:";

    private final OrderShipperRepository orderShipperRepository;
    private final ShipperLocationHistoryRepository locationHistoryRepository;
    private final ShipperIssueLogRepository issueLogRepository;
    private final ShipperHelpRequestRepository helpRequestRepository;
    private final OrderStatusLogRepository orderStatusLogRepository;
    private final StringRedisTemplate redisTemplate;
    private final SimpMessagingTemplate messagingTemplate;
    private final ObjectMapper objectMapper;

    @Transactional
    public ShipperDtos.LocationPayload updateLocation(User user, ShipperDtos.LocationUpdateRequest req, String source) {
        UUID shipperUserId = requireShipperUserId(user);
        if (req.getLat() == null || req.getLng() == null) {
            throw new BusinessException("lat and lng are required", HttpStatus.BAD_REQUEST);
        }

        Long orderId = req.getOrderId();
        LocalDateTime recordedAt = toRecordedAt(req.getTimestampEpochMs());
        if (orderId != null && orderId > 0) {
            OrderShipperView order = ensureOrderCanBeTrackedByShipper(orderId, shipperUserId);
            if (order.getShipperUserId() == null) {
                order.setShipperUserId(shipperUserId);
            }
            orderShipperRepository.updateDeliveryLocation(orderId, shipperUserId, req.getLat(), req.getLng(), req.getAccuracy(), req.getTimestampEpochMs());
        }

        ShipperLocationHistory location = ShipperLocationHistory.builder()
                .shipperUserId(shipperUserId)
                .orderId(orderId)
                .latitude(req.getLat())
                .longitude(req.getLng())
                .speed(req.getSpeed())
                .heading(req.getHeading())
                .accuracyMeters(req.getAccuracy())
                .source(limit(source, 20))
                .recordedAt(recordedAt)
                .build();
        locationHistoryRepository.save(location);

        ShipperDtos.LocationPayload payload = mapLocationPayload(location);
        cacheLatestLocation(shipperUserId, payload);
        broadcastLocation(payload);
        return payload;
    }

    @Transactional(readOnly = true)
    public ShipperDtos.LocationPayload getLatestLocation(UUID shipperUserId) {
        String key = LOCATION_KEY_PREFIX + shipperUserId;
        String cached = redisTemplate.opsForValue().get(key);
        if (StringUtils.hasText(cached)) {
            try {
                return objectMapper.readValue(cached, ShipperDtos.LocationPayload.class);
            } catch (Exception ignored) {
            }
        }

        return locationHistoryRepository.findTopByShipperUserIdOrderByRecordedAtDesc(shipperUserId)
                .map(this::mapLocationPayload)
                .orElse(null);
    }

    @Transactional(readOnly = true)
    public ShipperDtos.OrderTrackingResponse getOrderTracking(long orderId) {
        OrderShipperView order = orderShipperRepository.findById(orderId)
                .orElseThrow(() -> new BusinessException("Order not found", HttpStatus.NOT_FOUND));

        return ShipperDtos.OrderTrackingResponse.builder()
                .orderId(order.getId())
                .orderNumber(order.getOrderNumber())
                .orderStatus(order.getOrderStatus())
                .shipperUserId(order.getShipperUserId())
                .deliveryLatitude(order.getDeliveryLatitude())
                .deliveryLongitude(order.getDeliveryLongitude())
                .deliveryLocationAccuracyMeters(order.getDeliveryLocationAccuracyMeters())
                .deliveryLocationCapturedAt(order.getDeliveryLocationCapturedAt())
                .expectedDeliveryAt(order.getExpectedDeliveryAt())
                .pickedUpAt(order.getPickedUpAt())
                .deliveredAt(order.getDeliveredAt())
                .failedAt(order.getFailedAt())
                .failureReason(order.getFailureReason())
                .build();
    }

    @Transactional(readOnly = true)
    public List<ShipperDtos.AssignedOrderItem> listMyAssignedOrders(User user, boolean activeOnly, Integer limit) {
        UUID shipperUserId = requireShipperUserId(user);
        int limitEffective = limit == null ? 50 : Math.max(1, Math.min(200, limit));
        return orderShipperRepository.listAssignedOrders(shipperUserId, activeOnly, limitEffective).stream()
                .map(row -> ShipperDtos.AssignedOrderItem.builder()
                        .orderId(row.getOrderId())
                        .orderNumber(row.getOrderNumber())
                        .orderStatus(row.getOrderStatus())
                        .shipperUserId(row.getShipperUserId())
                        .expectedDeliveryAt(row.getExpectedDeliveryAt())
                        .pickedUpAt(row.getPickedUpAt())
                        .deliveredAt(row.getDeliveredAt())
                        .failedAt(row.getFailedAt())
                        .build())
                .toList();
    }

    @Transactional
    public void updateOrderStatus(User user, long orderId, ShipperDtos.StatusUpdateRequest req) {
        UUID shipperUserId = requireShipperUserId(user);
        String status = normalizeStatus(req.getStatus());

        OrderShipperView order = ensureOrderCanBeTrackedByShipper(orderId, shipperUserId);
        String previousStatus = order.getOrderStatus();

        if ("PICKED_UP".equals(status)) {
            order.setShipperUserId(shipperUserId);
            order.setOrderStatus("processing");
            if (order.getPickedUpAt() == null) {
                order.setPickedUpAt(LocalDateTime.now());
            }
            if (req.getExpectedDeliveryAt() != null) {
                order.setExpectedDeliveryAt(req.getExpectedDeliveryAt());
            }
        } else if ("DELIVERED".equals(status)) {
            order.setShipperUserId(shipperUserId);
            order.setOrderStatus("completed");
            order.setDeliveredAt(LocalDateTime.now());
            order.setDeliverySuccess(true);
        } else if ("FAILED".equals(status)) {
            order.setShipperUserId(shipperUserId);
            order.setOrderStatus("cancelled");
            order.setFailedAt(LocalDateTime.now());
            order.setDeliverySuccess(false);
            order.setFailureReason(limit(req.getFailureReason(), 400));
        } else {
            throw new BusinessException("Unsupported status for shipper", HttpStatus.BAD_REQUEST);
        }

        orderShipperRepository.save(order);
        orderStatusLogRepository.save(OrderStatusLog.builder()
                .orderId(orderId)
                .previousStatus(previousStatus)
                .newStatus(status)
                .note(limit(req.getNote(), 1000))
                .changedBy(safeUserLabel(user))
                .build());
    }

    @Transactional(readOnly = true)
    public ShipperDtos.PerformanceResponse getPerformance(UUID shipperUserId, LocalDateTime from, LocalDateTime to) {
        LocalDateTime fromEffective = from == null ? LocalDateTime.now().minusDays(30) : from;
        LocalDateTime toEffective = to == null ? LocalDateTime.now() : to;

        ShipperPerformanceProjection projection = orderShipperRepository.computePerformance(shipperUserId, fromEffective, toEffective);

        long completed = nullSafeLong(projection.getCompletedCount());
        long failed = nullSafeLong(projection.getFailedCount());
        long totalDone = completed + failed;

        BigDecimal successRate = totalDone == 0
                ? BigDecimal.ZERO
                : BigDecimal.valueOf((completed * 100.0) / totalDone).setScale(2, RoundingMode.HALF_UP);

        BigDecimal avgMinutes = projection.getAvgDeliveryMinutes() == null
                ? BigDecimal.ZERO
                : BigDecimal.valueOf(projection.getAvgDeliveryMinutes()).setScale(2, RoundingMode.HALF_UP);

        return ShipperDtos.PerformanceResponse.builder()
                .shipperUserId(shipperUserId)
                .from(fromEffective)
                .to(toEffective)
                .completedDeliveries(completed)
                .failedDeliveries(failed)
                .successRatePercent(successRate)
                .averageDeliveryMinutes(avgMinutes)
                .lateDeliveries(nullSafeLong(projection.getLateCount()))
                .build();
    }

    @Transactional
    public ShipperDtos.IssueResponse createIssue(User user, long orderId, ShipperDtos.IssueCreateRequest req) {
        UUID shipperUserId = requireShipperUserId(user);
        ensureOrderCanBeTrackedByShipper(orderId, shipperUserId);

        ShipperIssueLog issue = issueLogRepository.save(ShipperIssueLog.builder()
                .orderId(orderId)
                .shipperUserId(shipperUserId)
                .issueType(normalizeIssueType(req.getIssueType()))
                .message(limit(req.getMessage(), 1200))
                .status(IssueStatus.OPEN)
                .build());

        return mapIssue(issue);
    }

    @Transactional(readOnly = true)
    public List<ShipperDtos.IssueResponse> getOrderIssues(long orderId) {
        return issueLogRepository.findByOrderIdOrderByCreatedAtDesc(orderId).stream()
                .map(this::mapIssue)
                .toList();
    }

    @Transactional
    public ShipperDtos.HelpRequestResponse createHelpRequest(User user, long orderId, ShipperDtos.HelpRequestCreateRequest req) {
        UUID shipperUserId = requireShipperUserId(user);
        ensureOrderCanBeTrackedByShipper(orderId, shipperUserId);

        String message = limit(req.getMessage(), 1200);
        if (!StringUtils.hasText(message)) {
            throw new BusinessException("message is required", HttpStatus.BAD_REQUEST);
        }

        ShipperHelpRequest entity = helpRequestRepository.save(ShipperHelpRequest.builder()
                .orderId(orderId)
                .shipperUserId(shipperUserId)
                .message(message)
                .priority(normalizePriority(req.getPriority()))
                .status(HelpRequestStatus.OPEN)
                .build());

        ShipperDtos.HelpRequestResponse response = ShipperDtos.HelpRequestResponse.builder()
                .id(entity.getId())
                .orderId(entity.getOrderId())
                .shipperUserId(entity.getShipperUserId())
                .message(entity.getMessage())
                .priority(entity.getPriority())
                .status(entity.getStatus())
                .createdAt(entity.getCreatedAt())
                .build();

        messagingTemplate.convertAndSend("/topic/help/admin", response);
        messagingTemplate.convertAndSend("/topic/help/" + shipperUserId, response);
        return response;
    }

    private OrderShipperView ensureOrderCanBeTrackedByShipper(long orderId, UUID shipperUserId) {
        OrderShipperView order = orderShipperRepository.findById(orderId)
                .orElseThrow(() -> new BusinessException("Order not found", HttpStatus.NOT_FOUND));

        if (order.getShipperUserId() != null && !order.getShipperUserId().equals(shipperUserId)) {
            throw new BusinessException("Order is assigned to another shipper", HttpStatus.FORBIDDEN);
        }
        return order;
    }

    private UUID requireShipperUserId(User user) {
        if (user == null || user.getId() == null) {
            throw new BusinessException("Unauthorized", HttpStatus.UNAUTHORIZED);
        }
        return user.getId();
    }

    private void cacheLatestLocation(UUID shipperUserId, ShipperDtos.LocationPayload payload) {
        try {
            redisTemplate.opsForValue().set(
                    LOCATION_KEY_PREFIX + shipperUserId,
                    objectMapper.writeValueAsString(payload),
                    Duration.ofMinutes(15)
            );
        } catch (JsonProcessingException ignored) {
        }
    }

    private void broadcastLocation(ShipperDtos.LocationPayload payload) {
        if (payload.getOrderId() != null) {
            messagingTemplate.convertAndSend("/topic/orders/" + payload.getOrderId() + "/tracking", payload);
        }
        messagingTemplate.convertAndSend("/topic/shippers/" + payload.getShipperUserId() + "/tracking", payload);
    }

    private static LocalDateTime toRecordedAt(Long timestampEpochMs) {
        if (timestampEpochMs == null) {
            return LocalDateTime.now();
        }
        return LocalDateTime.ofInstant(Instant.ofEpochMilli(timestampEpochMs), ZoneOffset.UTC);
    }

    private ShipperDtos.LocationPayload mapLocationPayload(ShipperLocationHistory location) {
        return ShipperDtos.LocationPayload.builder()
                .shipperUserId(location.getShipperUserId())
                .orderId(location.getOrderId())
                .lat(location.getLatitude())
                .lng(location.getLongitude())
                .speed(location.getSpeed())
                .heading(location.getHeading())
                .accuracy(location.getAccuracyMeters())
                .recordedAt(location.getRecordedAt())
                .build();
    }

    private ShipperDtos.IssueResponse mapIssue(ShipperIssueLog issue) {
        return ShipperDtos.IssueResponse.builder()
                .id(issue.getId())
                .orderId(issue.getOrderId())
                .shipperUserId(issue.getShipperUserId())
                .issueType(issue.getIssueType())
                .message(issue.getMessage())
                .status(issue.getStatus())
                .createdAt(issue.getCreatedAt())
                .updatedAt(issue.getUpdatedAt())
                .build();
    }

    private static String normalizeStatus(String status) {
        if (!StringUtils.hasText(status)) {
            throw new BusinessException("status is required", HttpStatus.BAD_REQUEST);
        }
        return status.trim().toUpperCase(Locale.ROOT);
    }

    private static ShipperIssueType normalizeIssueType(String issueType) {
        if (!StringUtils.hasText(issueType)) {
            throw new BusinessException("issueType is required", HttpStatus.BAD_REQUEST);
        }
        try {
            return ShipperIssueType.valueOf(issueType.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException ex) {
            throw new BusinessException("Invalid issueType", HttpStatus.BAD_REQUEST);
        }
    }

    private static HelpRequestPriority normalizePriority(String priority) {
        if (!StringUtils.hasText(priority)) {
            return HelpRequestPriority.NORMAL;
        }
        try {
            return HelpRequestPriority.valueOf(priority.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException ex) {
            return HelpRequestPriority.NORMAL;
        }
    }

    private static String safeUserLabel(User user) {
        if (user == null) {
            return "unknown";
        }
        if (StringUtils.hasText(user.getEmail())) {
            return user.getEmail().trim();
        }
        return user.getId() == null ? "unknown" : user.getId().toString();
    }

    private static String limit(String value, int maxLen) {
        if (!StringUtils.hasText(value)) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.length() > maxLen ? trimmed.substring(0, maxLen) : trimmed;
    }

    private static long nullSafeLong(Long value) {
        return value == null ? 0L : value;
    }
}
