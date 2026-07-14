package com.example.shop.modules.cart.repository;

import java.time.LocalDateTime;
import java.util.UUID;

public interface AbandonedCartCandidateProjection {
    UUID getUserId();
    String getEmail();
    String getFirstName();
    Integer getItemCount();
    Integer getTotalQuantity();
    LocalDateTime getLastActivityAt();
}
