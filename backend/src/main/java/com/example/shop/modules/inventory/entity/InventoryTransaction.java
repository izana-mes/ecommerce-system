package com.example.shop.modules.inventory.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.LocalDateTime;
import java.util.Map;

@Entity
@Table(name = "inventory_transactions")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class InventoryTransaction {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "product_id", nullable = false, length = 50)
    private String productId;

    @Column(name = "reservation_code", length = 64)
    private String reservationCode;

    @Column(name = "order_number", length = 64)
    private String orderNumber;

    @Column(name = "transaction_type", nullable = false, length = 40)
    private String transactionType;

    @Column(name = "quantity", nullable = false)
    private Integer quantity;

    @Column(name = "before_available_stock", nullable = false)
    private Integer beforeAvailableStock;

    @Column(name = "after_available_stock", nullable = false)
    private Integer afterAvailableStock;

    @Column(name = "before_reserved_stock", nullable = false)
    private Integer beforeReservedStock;

    @Column(name = "after_reserved_stock", nullable = false)
    private Integer afterReservedStock;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "metadata", columnDefinition = "jsonb")
    private Map<String, Object> metadata;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;
}
