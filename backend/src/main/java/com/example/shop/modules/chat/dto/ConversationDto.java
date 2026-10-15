package com.example.shop.modules.chat.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ConversationDto {
    private String conversationId;
    private String type; // direct, group, support, order
    private String title;
    private String avatarUrl;
    private String orderId;
    private String status;
    private String lastMessageId;
    private String lastMessagePreview;
    private LocalDateTime lastMessageAt;
    private Integer unreadCount;
    private Boolean pinned;
    private Boolean isOnline;
    private List<MemberDto> participants;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
