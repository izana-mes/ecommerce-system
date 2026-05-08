package com.example.shop.modules.product.entity;

import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import java.time.LocalDateTime;
import jakarta.persistence.*;
import lombok.*;

import java.util.UUID;

@Entity
@Table(name = "products", indexes = {
        @Index(name = "idx_products_seller_user_id", columnList = "seller_user_id"),
        @Index(name = "idx_products_supplier_user_id", columnList = "supplier_user_id")
})
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
@EntityListeners(AuditingEntityListener.class)
public class Product {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "product_id", unique = true, nullable = false, length = 50)
    private String productID;

    @Column(name = "front_img", nullable = false, columnDefinition = "TEXT")
    private String frontImg;

    @Column(name = "back_img", columnDefinition = "TEXT")
    private String backImg;

    @Column(name = "product_name", nullable = false)
    private String productName;

    @Column(name = "product_price", nullable = false)
    private Double productPrice;

    @Column(name = "old_price")
    private Double oldPrice;

    @Column(name = "product_reviews", columnDefinition = "TEXT")
    private String productReviews;

    @Column(name = "category", nullable = false, length = 80)
    private String category;

    @Column(name = "sizes", columnDefinition = "TEXT")
    private String sizes;

    @Builder.Default
    @Column(name = "stock_quantity", nullable = false, columnDefinition = "integer default 25")
    private Integer stockQuantity = 25;

    @Builder.Default
    @Column(name = "active", nullable = false, columnDefinition = "boolean default true")
    private Boolean active = true;

    /** Legacy supplier association (supplier portal). */
    @Column(name = "supplier_user_id")
    private UUID supplierUserId;

    /**
     * Seller association — the user who owns this product in the seller portal.
     * Maps to the {@code seller_user_id} column added alongside the seller feature.
     */
    @Column(name = "seller_user_id")
    private UUID sellerUserId;

    @CreatedDate
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @LastModifiedDate
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
}
