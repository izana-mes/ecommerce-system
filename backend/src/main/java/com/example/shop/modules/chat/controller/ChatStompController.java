package com.example.shop.modules.chat.controller;

import com.example.shop.modules.chat.dto.SendMessageRequest;
import com.example.shop.modules.chat.dto.WebSocketStompRequest;
import com.example.shop.modules.chat.service.ChatService;
import com.example.shop.modules.user.entity.User;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.handler.annotation.DestinationVariable;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Controller;

import java.security.Principal;

@Controller
@RequiredArgsConstructor
@Slf4j
public class ChatStompController {

    private final ChatService chatService;

    private User extractUser(Principal principal) {
        if (principal instanceof Authentication auth && auth.getPrincipal() instanceof User user) {
            return user;
        }
        return null;
    }

    @MessageMapping("/chat.send.{conversationId}")
    public void sendMessage(
            @DestinationVariable String conversationId,
            @Payload WebSocketStompRequest request,
            Principal principal) {
        User user = extractUser(principal);
        if (user == null) {
            log.warn("Unauthorized STOMP send to {}", conversationId);
            return;
        }
        try {
            SendMessageRequest req = SendMessageRequest.builder()
                    .body(request.getBody())
                    .replyToMessageId(request.getReplyToMessageId())
                    .build();
            chatService.sendMessage(conversationId, user, req);
        } catch (Exception ex) {
            log.warn("Error sending message via STOMP: {}", ex.getMessage());
        }
    }

    @MessageMapping("/chat.typing.{conversationId}")
    public void typing(
            @DestinationVariable String conversationId,
            @Payload WebSocketStompRequest request,
            Principal principal) {
        User user = extractUser(principal);
        if (user == null) return;
        try {
            boolean isTyping = "TYPING_START".equalsIgnoreCase(request.getEventType());
            chatService.handleTyping(conversationId, user, isTyping);
        } catch (Exception ex) {
            log.warn("Error handling typing via STOMP: {}", ex.getMessage());
        }
    }

    @MessageMapping("/chat.read.{conversationId}")
    public void markRead(
            @DestinationVariable String conversationId,
            Principal principal) {
        User user = extractUser(principal);
        if (user == null) return;
        try {
            chatService.markAsRead(conversationId, user);
        } catch (Exception ex) {
            log.warn("Error handling read via STOMP: {}", ex.getMessage());
        }
    }

    @MessageMapping("/chat.react.{messageId}")
    public void react(
            @DestinationVariable String messageId,
            @Payload WebSocketStompRequest request,
            Principal principal) {
        User user = extractUser(principal);
        if (user == null) return;
        try {
            if (request.getReaction() != null && !request.getReaction().isBlank()) {
                chatService.toggleReaction(messageId, user, request.getReaction());
            }
        } catch (Exception ex) {
            log.warn("Error handling reaction via STOMP: {}", ex.getMessage());
        }
    }
}
