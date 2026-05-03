package com.example.shop.modules.staff.dto;

import java.util.List;

public record StaffOrderPageDto(
        List<StaffOrderDto> content,
        long total,
        int page,
        int size,
        int totalPages
) {}
