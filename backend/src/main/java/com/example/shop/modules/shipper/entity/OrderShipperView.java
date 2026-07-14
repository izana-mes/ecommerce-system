package com.example.shop.modules.shipper.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

@Getter
@Setter
@Entity
@Table(name = "orders")
public class OrderShipperView {

    @Id
    @Column(name = "id")
    private Long id;

    @Column(name = "order_number")
    private String orderNumber;

    @Column(name = "order_status")
    private String orderStatus;

    @Column(name = "shipper_user_id")
    private UUID shipperUserId;

    @Column(name = "delivery_latitude", precision = 10, scale = 7)
    private BigDecimal deliveryLatitude;

    @Column(name = "delivery_longitude", precision = 10, scale = 7)
    private BigDecimal deliveryLongitude;

    @Column(name = "delivery_location_accuracy_meters", precision = 10, scale = 2)
    private BigDecimal deliveryLocationAccuracyMeters;

    @Column(name = "delivery_location_captured_at")
    private Long deliveryLocationCapturedAt;

    @Column(name = "expected_delivery_at")
    private LocalDateTime expectedDeliveryAt;

    @Column(name = "picked_up_at")
    private LocalDateTime pickedUpAt;

    @Column(name = "delivered_at")
    private LocalDateTime deliveredAt;

    @Column(name = "failed_at")
    private LocalDateTime failedAt;

    @Column(name = "delivery_success")
    private Boolean deliverySuccess;

    @Column(name = "failure_reason")
    private String failureReason;

    @Column(name = "customer_first_name")
    private String customerFirstName;

    @Column(name = "customer_last_name")
    private String customerLastName;

    @Column(name = "customer_phone")
    private String customerPhone;

    @Column(name = "customer_email")
    private String customerEmail;

    @Column(name = "shipping_address_line1")
    private String shippingAddressLine1;
}
