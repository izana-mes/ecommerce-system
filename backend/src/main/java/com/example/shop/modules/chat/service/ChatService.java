package com.example.shop.modules.chat.service;

import com.example.shop.modules.chat.dto.*;
import com.example.shop.modules.user.entity.User;

import java.util.List;

public interface ChatService {
    List<ConversationDto> getConversations(User currentUser, String search);

    ConversationDto getConversation(String conversationId, User currentUser);

    ConversationDto createOrGetDirectConversation(User currentUser, String targetUserId, String initialMessage);

    ConversationDto createGroupConversation(User currentUser, CreateConversationRequest request);

    ConversationDto createSupportConversation(User currentUser, String initialMessage);

    List<MessageDto> getMessages(String conversationId, User currentUser, String beforeMessageId, int limit);

    MessageDto sendMessage(String conversationId, User currentUser, SendMessageRequest request);

    MessageDto editMessage(String messageId, User currentUser, EditMessageRequest request);

    void deleteMessage(String messageId, User currentUser);

    MessageDto toggleReaction(String messageId, User currentUser, String reaction);

    void removeReaction(String messageId, User currentUser, String reaction);

    void markAsRead(String conversationId, User currentUser);

    List<UserSearchResultDto> searchUsers(User currentUser, String query, int limit);

    void handleTyping(String conversationId, User currentUser, boolean typing);

    boolean hasConversationAccess(String conversationId, User currentUser);
}
