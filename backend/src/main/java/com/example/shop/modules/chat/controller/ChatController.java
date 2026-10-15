package com.example.shop.modules.chat.controller;

import com.example.shop.common.exception.BusinessException;
import com.example.shop.modules.chat.dto.*;
import com.example.shop.modules.chat.service.ChatService;
import com.example.shop.modules.user.entity.User;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequiredArgsConstructor
public class ChatController {

    private final ChatService chatService;

    private User requireUser(Authentication auth) {
        if (auth == null || !(auth.getPrincipal() instanceof User user)) {
            throw new BusinessException("Unauthorized", HttpStatus.UNAUTHORIZED);
        }
        return user;
    }

    // Conversations endpoints
    @GetMapping({"/api/conversations", "/api/chat/conversations"})
    public ResponseEntity<List<ConversationDto>> getConversations(
            @RequestParam(required = false) String search,
            Authentication auth) {
        User user = requireUser(auth);
        return ResponseEntity.ok(chatService.getConversations(user, search));
    }

    @PostMapping({"/api/conversations", "/api/chat/conversations"})
    public ResponseEntity<ConversationDto> createConversation(
            @Valid @RequestBody CreateConversationRequest request,
            Authentication auth) {
        User user = requireUser(auth);
        ConversationDto dto;
        if ("direct".equalsIgnoreCase(request.getType())) {
            if (request.getTargetUserId() == null || request.getTargetUserId().isBlank()) {
                throw new BusinessException("targetUserId is required for direct conversation", HttpStatus.BAD_REQUEST);
            }
            dto = chatService.createOrGetDirectConversation(user, request.getTargetUserId(), request.getInitialMessage());
        } else if ("support".equalsIgnoreCase(request.getType())) {
            dto = chatService.createSupportConversation(user, request.getInitialMessage());
        } else {
            dto = chatService.createGroupConversation(user, request);
        }
        return ResponseEntity.status(HttpStatus.CREATED).body(dto);
    }

    @PostMapping({"/api/conversations/direct", "/api/chat/conversations/direct"})
    public ResponseEntity<ConversationDto> createDirectConversation(
            @RequestParam String targetUserId,
            @RequestParam(required = false) String initialMessage,
            Authentication auth) {
        User user = requireUser(auth);
        ConversationDto dto = chatService.createOrGetDirectConversation(user, targetUserId, initialMessage);
        return ResponseEntity.status(HttpStatus.CREATED).body(dto);
    }

    @GetMapping({"/api/conversations/{conversationId}", "/api/chat/conversations/{conversationId}"})
    public ResponseEntity<ConversationDto> getConversation(
            @PathVariable String conversationId,
            Authentication auth) {
        User user = requireUser(auth);
        return ResponseEntity.ok(chatService.getConversation(conversationId, user));
    }

    @GetMapping({"/api/conversations/{conversationId}/messages", "/api/chat/conversations/{conversationId}/messages"})
    public ResponseEntity<List<MessageDto>> getMessages(
            @PathVariable String conversationId,
            @RequestParam(required = false) String before,
            @RequestParam(defaultValue = "50") int limit,
            Authentication auth) {
        User user = requireUser(auth);
        return ResponseEntity.ok(chatService.getMessages(conversationId, user, before, limit));
    }

    @PostMapping({"/api/conversations/{conversationId}/messages", "/api/chat/conversations/{conversationId}/messages"})
    public ResponseEntity<MessageDto> sendMessage(
            @PathVariable String conversationId,
            @Valid @RequestBody SendMessageRequest request,
            Authentication auth) {
        User user = requireUser(auth);
        MessageDto dto = chatService.sendMessage(conversationId, user, request);
        return ResponseEntity.status(HttpStatus.CREATED).body(dto);
    }

    @PostMapping({"/api/conversations/{conversationId}/read", "/api/chat/conversations/{conversationId}/read"})
    public ResponseEntity<Void> markAsRead(
            @PathVariable String conversationId,
            Authentication auth) {
        User user = requireUser(auth);
        chatService.markAsRead(conversationId, user);
        return ResponseEntity.noContent().build();
    }

    // Message CRUD endpoints
    @PatchMapping({"/api/messages/{messageId}", "/api/chat/messages/{messageId}"})
    public ResponseEntity<MessageDto> editMessage(
            @PathVariable String messageId,
            @Valid @RequestBody EditMessageRequest request,
            Authentication auth) {
        User user = requireUser(auth);
        return ResponseEntity.ok(chatService.editMessage(messageId, user, request));
    }

    @DeleteMapping({"/api/messages/{messageId}", "/api/chat/messages/{messageId}"})
    public ResponseEntity<Void> deleteMessage(
            @PathVariable String messageId,
            Authentication auth) {
        User user = requireUser(auth);
        chatService.deleteMessage(messageId, user);
        return ResponseEntity.noContent().build();
    }

    @PostMapping({"/api/messages/{messageId}/reactions", "/api/chat/messages/{messageId}/reactions"})
    public ResponseEntity<MessageDto> toggleReaction(
            @PathVariable String messageId,
            @Valid @RequestBody ReactionRequest request,
            Authentication auth) {
        User user = requireUser(auth);
        return ResponseEntity.ok(chatService.toggleReaction(messageId, user, request.getReaction()));
    }

    @DeleteMapping({"/api/messages/{messageId}/reactions/{reaction}", "/api/chat/messages/{messageId}/reactions/{reaction}"})
    public ResponseEntity<Void> removeReaction(
            @PathVariable String messageId,
            @PathVariable String reaction,
            Authentication auth) {
        User user = requireUser(auth);
        chatService.removeReaction(messageId, user, reaction);
        return ResponseEntity.noContent().build();
    }

    // Users search for starting conversations
    @GetMapping({"/api/conversations/users/search", "/api/chat/users/search"})
    public ResponseEntity<List<UserSearchResultDto>> searchUsers(
            @RequestParam String q,
            @RequestParam(defaultValue = "20") int limit,
            Authentication auth) {
        User user = requireUser(auth);
        return ResponseEntity.ok(chatService.searchUsers(user, q, limit));
    }
}
