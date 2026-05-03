package com.example.shop.modules.staff.dto;

import lombok.Data;

@Data
public class RespondIssueRequest {
    private String response;
    private boolean markResolved;
}
