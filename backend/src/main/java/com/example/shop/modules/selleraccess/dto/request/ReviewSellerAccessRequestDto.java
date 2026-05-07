package com.example.shop.modules.selleraccess.dto.request;

import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class ReviewSellerAccessRequestDto {

    @Size(max = 1000, message = "Reviewer note must be at most 1000 characters")
    private String note;
}

