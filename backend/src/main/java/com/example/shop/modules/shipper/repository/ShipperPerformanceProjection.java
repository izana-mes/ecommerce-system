package com.example.shop.modules.shipper.repository;

public interface ShipperPerformanceProjection {
    Long getCompletedCount();
    Long getFailedCount();
    Double getAvgDeliveryMinutes();
    Long getLateCount();
}
