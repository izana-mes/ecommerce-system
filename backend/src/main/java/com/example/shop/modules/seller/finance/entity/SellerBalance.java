package com.example.shop.modules.seller.finance.entity;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "seller_balance")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SellerBalance {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "seller_user_id", unique = true, nullable = false)
    private UUID sellerUserId;

    @Builder.Default
    @Column(name = "available_balance", nullable = false, precision = 19, scale = 2)
    private BigDecimal availableBalance = BigDecimal.ZERO;

    @Builder.Default
    @Column(name = "pending_balance", nullable = false, precision = 19, scale = 2)
    private BigDecimal pendingBalance = BigDecimal.ZERO;

    @Builder.Default
    @Column(name = "total_earned", nullable = false, precision = 19, scale = 2)
    private BigDecimal totalEarned = BigDecimal.ZERO;

    @Builder.Default
    @Column(name = "currency", nullable = false, length = 3)
    private String currency = "USD";

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    @PrePersist
    @PreUpdate
    public void touch() {
        this.updatedAt = LocalDateTime.now();
    }
}

