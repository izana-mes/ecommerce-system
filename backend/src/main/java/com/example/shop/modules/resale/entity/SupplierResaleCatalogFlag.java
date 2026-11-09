package com.example.shop.modules.resale.entity;

import jakarta.persistence.*;
import lombok.*;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import java.time.LocalDateTime;

@Entity
@Table(name = "supplier_resale_catalog_flags")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
@EntityListeners(AuditingEntityListener.class)
public class SupplierResaleCatalogFlag {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "product_id", nullable = false, length = 50, unique = true)
    private String productId;

    @Column(name = "supplier_user_id", nullable = false)
    private java.util.UUID supplierUserId;

    @Builder.Default
    @Column(name = "resale_enabled", nullable = false)
    private Boolean resaleEnabled = false;

    @Column(name = "wholesale_price", precision = 12, scale = 2)
    private java.math.BigDecimal wholesalePrice;

    @Builder.Default
    @Column(name = "minimum_order_quantity", nullable = false)
    private Integer minimumOrderQuantity = 1;

    @Builder.Default
    @Column(name = "supplier_product_approved", nullable = false)
    private Boolean supplierProductApproved = false;

    @Column(name = "commercial_note", columnDefinition = "TEXT")
    private String commercialNote;

    @CreatedDate
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @LastModifiedDate
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
}
