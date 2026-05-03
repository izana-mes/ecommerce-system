package com.example.shop.modules.staff.dto;

public record ShipperDto(
        String id,
        String email,
        String firstName,
        String lastName,
        long activeOrderCount
) {}
