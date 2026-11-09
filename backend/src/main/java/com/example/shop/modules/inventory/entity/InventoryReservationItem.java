package com.example.shop.modules.inventory.entity;

import jakarta.persistence.*;
import lombok.*;
import com.example.shop.modules.resale.entity.SupplierProduct;

@Entity
@Table(name = "inventory_reservation_items")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class InventoryReservationItem {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "reservation_id", nullable = false)
    private InventoryReservation reservation;

    @Column(name = "product_id", nullable = false, length = 50)
    private String productId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "supplier_offer_id")
    private SupplierProduct supplierOffer;

    @Column(name = "seller_listing_id")
    private java.util.UUID sellerListingId;

    @Column(name = "quantity", nullable = false)
    private Integer quantity;
}
