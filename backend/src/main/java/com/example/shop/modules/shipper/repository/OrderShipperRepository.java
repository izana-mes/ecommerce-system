package com.example.shop.modules.shipper.repository;

import com.example.shop.modules.shipper.entity.OrderShipperView;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface OrderShipperRepository extends JpaRepository<OrderShipperView, Long> {

    @Query(value = """
            SELECT
                COUNT(*) FILTER (WHERE delivered_at IS NOT NULL) AS completedCount,
                COUNT(*) FILTER (WHERE failed_at IS NOT NULL) AS failedCount,
                AVG(EXTRACT(EPOCH FROM ((COALESCE(delivered_at, failed_at)) - picked_up_at)) / 60.0)
                    FILTER (WHERE picked_up_at IS NOT NULL AND (delivered_at IS NOT NULL OR failed_at IS NOT NULL)) AS avgDeliveryMinutes,
                COUNT(*) FILTER (WHERE expected_delivery_at IS NOT NULL AND delivered_at IS NOT NULL AND delivered_at > expected_delivery_at) AS lateCount
            FROM orders
            WHERE shipper_user_id = :shipperUserId
              AND COALESCE(delivered_at, failed_at, picked_up_at, updated_at) BETWEEN :fromTime AND :toTime
            """, nativeQuery = true)
    ShipperPerformanceProjection computePerformance(@Param("shipperUserId") UUID shipperUserId,
                                                    @Param("fromTime") LocalDateTime fromTime,
                                                    @Param("toTime") LocalDateTime toTime);

    @Modifying
    @Query(value = """
            UPDATE orders
            SET shipper_user_id = COALESCE(shipper_user_id, :shipperUserId),
                delivery_latitude = :lat,
                delivery_longitude = :lng,
                delivery_location_accuracy_meters = :accuracy,
                delivery_location_captured_at = :capturedAt,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = :orderId
            """, nativeQuery = true)
    int updateDeliveryLocation(@Param("orderId") Long orderId,
                               @Param("shipperUserId") UUID shipperUserId,
                               @Param("lat") BigDecimal lat,
                               @Param("lng") BigDecimal lng,
                               @Param("accuracy") BigDecimal accuracy,
                               @Param("capturedAt") Long capturedAt);

    @Query(value = """
            SELECT
                o.id AS orderId,
                o.order_number AS orderNumber,
                o.order_status AS orderStatus,
                o.shipper_user_id AS shipperUserId,
                o.expected_delivery_at AS expectedDeliveryAt,
                o.picked_up_at AS pickedUpAt,
                o.delivered_at AS deliveredAt,
                o.failed_at AS failedAt,
                o.customer_first_name AS customerFirstName,
                o.customer_last_name AS customerLastName,
                o.customer_phone AS customerPhone,
                o.shipping_address_line1 AS shippingAddressLine1
            FROM orders o
            WHERE o.shipper_user_id = :shipperUserId
              AND (:activeOnly = false OR o.order_status NOT IN ('completed', 'cancelled'))
            ORDER BY COALESCE(o.picked_up_at, o.updated_at) DESC, o.id DESC
            LIMIT :limitRows
            """, nativeQuery = true)
    List<ShipperOrderListProjection> listAssignedOrders(@Param("shipperUserId") UUID shipperUserId,
                                                       @Param("activeOnly") boolean activeOnly,
                                                       @Param("limitRows") int limitRows);
}
