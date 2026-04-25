package com.example.shop.modules.supportchat.service;

import com.example.shop.modules.supportchat.dto.ConversationSummaryDto;
import com.example.shop.modules.supportchat.dto.SupportChatResponseDto;
import com.example.shop.modules.supportchat.dto.SendMessageRequest;

import java.util.List;

public interface SupportChatService {
    SupportChatResponseDto getMessages(String conversationId, Object principal, String guestId);
    SupportChatResponseDto sendMessage(SendMessageRequest request, Object principal, String guestId);
    
    // For Admin / Staff
    List<ConversationSummaryDto> getConversations(int limit);
}
