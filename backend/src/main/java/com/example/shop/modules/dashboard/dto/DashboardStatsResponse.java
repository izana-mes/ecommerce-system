package com.example.shop.modules.dashboard.dto;

/**
 * DTO record containing enterprise statistics.
 */
public record DashboardStatsResponse(
    long products,
    long customers,
    long suppliers,
    long orders,
    double revenue,
    long employees,
    long warehouses,
    long trustedPartners
) {}
