package com.example.shop.modules.chat.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class MemberDto {
    private String userId;
    private String username;
    private String email;
    private String fullName;
    private String role;
    private Boolean isOnline;
    private LocalDateTime lastSeenAt;
}
