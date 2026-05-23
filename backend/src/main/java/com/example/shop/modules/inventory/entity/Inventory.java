package com.example.shop.modules.inventory.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

@Entity
@Table(name = "inventories")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Inventory {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "product_id", nullable = false, unique = true, length = 50)
    private String productId;

    @Column(name = "available_stock", nullable = false)
    private Integer availableStock;

    @Column(name = "reserved_stock", nullable = false)
    private Integer reservedStock;

    @Column(name = "packed_stock", nullable = false)
    private Integer packedStock;

    @Column(name = "in_transit_stock", nullable = false)
    private Integer inTransitStock;

    @Column(name = "returned_stock", nullable = false)
    private Integer returnedStock;

    @Column(name = "damaged_stock", nullable = false)
    private Integer damagedStock;

    @Version
    @Column(name = "version", nullable = false)
    private Long version;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;
}
