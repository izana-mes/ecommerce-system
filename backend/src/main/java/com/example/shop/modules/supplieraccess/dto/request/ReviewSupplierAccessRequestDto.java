package com.example.shop.modules.supplieraccess.dto.request;

import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class ReviewSupplierAccessRequestDto {

    @Size(max = 1000, message = "Reviewer note must be at most 1000 characters")
    private String note;
}
