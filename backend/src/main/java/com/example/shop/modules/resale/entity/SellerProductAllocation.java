package com.example.shop.modules.resale.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity @Table(name = "seller_product_allocations")
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class SellerProductAllocation {
    @Id @GeneratedValue(strategy = GenerationType.UUID) private UUID id;
    @OneToOne(fetch = FetchType.LAZY, optional = false) @JoinColumn(name = "listing_id", nullable = false) private SellerProductListing listing;
    @ManyToOne(fetch = FetchType.LAZY, optional = false) @JoinColumn(name = "supplier_offer_id", nullable = false) private SupplierProduct supplierOffer;
    @Column(name = "seller_user_id", nullable = false) private UUID sellerUserId;
    @Column(name = "supplier_user_id", nullable = false) private UUID supplierUserId;
    @Column(name = "allocated_quantity", nullable = false) private Integer allocatedQuantity;
    @Column(name = "sold_quantity", nullable = false) private Integer soldQuantity;
    @Column(name = "reserved_quantity", nullable = false) private Integer reservedQuantity;
    @Column(nullable = false) private String status;
    @Column(name = "created_at", insertable = false, updatable = false) private LocalDateTime createdAt;
    @Column(name = "updated_at", insertable = false, updatable = false) private LocalDateTime updatedAt;
    public int remaining() { return allocatedQuantity - soldQuantity - reservedQuantity; }
}
