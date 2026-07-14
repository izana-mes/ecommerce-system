package com.example.shop.modules.inventory.service;

import com.example.shop.modules.inventory.dto.InventoryReservationDtos;
import com.example.shop.modules.user.entity.User;

public interface InventoryReservationService {

    InventoryReservationDtos.ReservationResponse reserve(InventoryReservationDtos.ReserveRequest request, User user);

    InventoryReservationDtos.ReservationResponse confirm(String reservationCode);

    InventoryReservationDtos.ReservationResponse release(String reservationCode, String reason);

    InventoryReservationDtos.ReservationResponse confirmByOrderNumber(String orderNumber);

    InventoryReservationDtos.ReservationResponse releaseByOrderNumber(String orderNumber, String reason);

    int expireReservations();
}
