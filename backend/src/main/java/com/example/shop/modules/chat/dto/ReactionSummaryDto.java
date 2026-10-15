package com.example.shop.modules.chat.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ReactionSummaryDto {
    private String reaction; // like, love, haha, wow, sad, angry
    private Integer count;
    private Boolean reactedByMe;
}
