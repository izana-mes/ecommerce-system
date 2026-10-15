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
public class MessageDto {
    private String messageId;
    private String conversationId;
    private String senderUserId;
    private String senderName;
    private String senderRole;
    private String senderAvatarUrl;
    private String body;
    private Boolean edited;
    private LocalDateTime editedAt;
    private Boolean deleted;
    private LocalDateTime deletedAt;
    private String replyToMessageId;
    private MessageDto replyToMessage;
    private List<ReactionSummaryDto> reactions;
    private String myReaction;
    private LocalDateTime createdAt;
}
