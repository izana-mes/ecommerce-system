package com.example.shop.modules.resale.entity;

import com.example.shop.modules.product.entity.Product;
import com.example.shop.modules.user.entity.User;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "supplier_products", uniqueConstraints = @UniqueConstraint(name = "uq_supplier_product", columnNames = {"supplier_user_id", "product_id"}))
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class SupplierProduct {
    @Id @GeneratedValue(strategy = GenerationType.UUID) private UUID id;
    @ManyToOne(fetch = FetchType.LAZY, optional = false) @JoinColumn(name = "product_id", referencedColumnName = "product_id", nullable = false) private Product product;
    @ManyToOne(fetch = FetchType.LAZY, optional = false) @JoinColumn(name = "supplier_user_id", nullable = false) private User supplier;
    @Column(name = "supplier_sku", length = 100) private String supplierSku;
    @Column(name = "wholesale_price", nullable = false, precision = 12, scale = 2) private BigDecimal wholesalePrice;
    @Column(name = "stock_quantity", nullable = false) private Integer stockQuantity;
    @Column(name = "reserved_quantity", nullable = false) private Integer reservedQuantity;
    @Column(name = "minimum_order_quantity", nullable = false) private Integer minimumOrderQuantity;
    @Column(nullable = false) private Boolean approved;
    @Column(nullable = false) private Boolean available;
    @Column(name = "allow_resale", nullable = false) @Builder.Default private Boolean allowResale = false;
    @Column(name = "supply_terms", columnDefinition = "TEXT") private String supplyTerms;
    @Column(name = "direct_retail_enabled", nullable = false) private Boolean directRetailEnabled;
    @Column(name = "direct_retail_price", precision = 12, scale = 2) private BigDecimal directRetailPrice;
    @CreationTimestamp @Column(name = "created_at", updatable = false) private LocalDateTime createdAt;
    @UpdateTimestamp @Column(name = "updated_at") private LocalDateTime updatedAt;
}
