package com.example.shop.modules.order.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Positive;
import lombok.Data;

import java.util.ArrayList;
import java.util.List;

@Data
public class OrderCreateRequest {

    private String customerEmail;

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

    @NotBlank(message = "paymentMethod is required")
    private String paymentMethod;

    private String orderSource;
    private String currency;
    private Double shippingFee;
    private Double vat;
    private String couponCode;
    private Double couponDiscount;
    private Long couponAssignmentId;

    @Valid
    @NotEmpty(message = "items is required")
    private List<Item> items = new ArrayList<>();

    @Data
    public static class Item {
        @NotBlank(message = "productID is required")
        private String productID;

        @NotNull(message = "quantity is required")
        @Positive(message = "quantity must be greater than 0")
        private Integer quantity;
    }
}
