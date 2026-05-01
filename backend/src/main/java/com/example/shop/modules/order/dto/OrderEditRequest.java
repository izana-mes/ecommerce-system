package com.example.shop.modules.order.dto;

import lombok.Data;

@Data
public class OrderEditRequest {

    private String customerFirstName;
    private String customerLastName;
    private String customerPhone;
    
    private String shippingAddressLine1;
    private String shippingAddressLine2;
    private String shippingCity;
    private String shippingState;
    private String shippingPostalCode;
    private String shippingCountry;
    
    private String notes;
    
    private Double deliveryLatitude;
    private Double deliveryLongitude;
    private String deliveryLocationLabel;
    private Double deliveryLocationAccuracyMeters;
    private Long deliveryLocationCapturedAt;
}
