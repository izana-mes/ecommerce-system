package com.example.shop.modules.ordercheckouthistory.dto;

import lombok.Builder;

@Builder
public record CheckoutHistoryEntryDto(
        String firstName,
        String lastName,
        String companyName,
        String country,
        String streetAddress1,
        String streetAddress2,
        String city,
        String postalCode,
        String phone,
        String email,
        String notes,
        long savedAt
) {
}
