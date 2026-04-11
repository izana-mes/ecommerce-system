package com.example.shop.modules.product.entity;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.LastModifiedDate;

import java.time.LocalDateTime;
import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "products")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
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

    @Column(name = "product_reviews", columnDefinition = "TEXT")
    private String productReviews;

    @Builder.Default
    @Column(name = "stock_quantity", nullable = false, columnDefinition = "integer default 25")
    private Integer stockQuantity = 25;

    @Builder.Default
    @Column(name = "active", nullable = false, columnDefinition = "boolean default true")
    private Boolean active = true;


    @CreatedDate
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @LastModifiedDate
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
}
