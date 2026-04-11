package com.example.shop.modules.product.dto;

import lombok.Data;
import java.io.Serial;
import java.io.Serializable;

@Data
public class ProductDto implements Serializable {

    @Serial
    private static final long serialVersionUID = 1L;

    private String productID;
    private String frontImg;
    private String backImg;
    private String productName;
    private Double productPrice;
    private String productReviews;
    private Integer stockQuantity;
    private Boolean active;
}
