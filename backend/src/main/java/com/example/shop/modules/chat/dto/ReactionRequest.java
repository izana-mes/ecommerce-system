package com.example.shop.modules.chat.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ReactionRequest {
    @NotBlank(message = "Reaction cannot be blank")
    private String reaction; // like, love, care, haha, wow, sad, angry
}
