package com.example.shop.modules.notification.dto;

import lombok.Data;

import java.util.ArrayList;
import java.util.List;

@Data
public class OrderPaidEmailRequest {
    private String to;
    private String orderNumber;
    private String currency;
    private double subtotal;
    private double shippingFee;
    private double vat;
    private double totalAmount;
    private String paymentMethod;
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
    private List<Item> items = new ArrayList<>();

    @Data
    public static class Item {
        private String productID;
        private String productName;
        private double unitPrice;
        private int quantity;
        private double lineTotal;
    }
}
