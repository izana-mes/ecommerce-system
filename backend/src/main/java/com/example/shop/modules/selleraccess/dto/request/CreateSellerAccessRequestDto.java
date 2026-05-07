package com.example.shop.modules.selleraccess.dto.request;

import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class CreateSellerAccessRequestDto {

    @Size(max = 255, message = "Business name must be at most 255 characters")
    private String businessName;

    @Size(max = 500, message = "Website URL must be at most 500 characters")
    private String websiteUrl;

    @Size(max = 50, message = "Contact phone must be at most 50 characters")
    private String contactPhone;

    @Size(max = 1000, message = "Note must be at most 1000 characters")
    private String note;
}

