package com.example.shop.modules.resale.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class RevokeAuthorizationDto {

    @NotBlank(message = "reason is required when revoking an authorization")
    private String reason;
}
