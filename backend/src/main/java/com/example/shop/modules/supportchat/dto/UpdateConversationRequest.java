package com.example.shop.modules.supportchat.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class UpdateConversationRequest {
    private String status;
    private String priority;
    private String internalNote;
    private Boolean assignToSelf;
    private Boolean clearAssignment;
}
