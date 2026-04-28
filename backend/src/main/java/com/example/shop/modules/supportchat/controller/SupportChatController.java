package com.example.shop.modules.supportchat.controller;

import com.example.shop.modules.supportchat.dto.ConversationSummaryDto;
import com.example.shop.modules.supportchat.dto.SendMessageRequest;
import com.example.shop.modules.supportchat.dto.SupportChatResponseDto;
import com.example.shop.modules.supportchat.dto.UpdateConversationRequest;
import com.example.shop.modules.supportchat.service.SupportChatService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/support-chat")
@RequiredArgsConstructor
public class SupportChatController {

    private final SupportChatService supportChatService;

    @GetMapping("/messages")
    public ResponseEntity<SupportChatResponseDto> getMessages(
            @RequestParam(required = false) String conversationId,
            @RequestHeader(value = "x-guest-id", required = false) String guestId,
            Authentication authentication) {

        Object principal = authentication != null ? authentication.getPrincipal() : null;
        SupportChatResponseDto response = supportChatService.getMessages(conversationId, principal, guestId);
        return ResponseEntity.ok(response);
    }

    @PostMapping("/messages")
    public ResponseEntity<SupportChatResponseDto> sendMessage(
            @RequestBody SendMessageRequest request,
            @RequestHeader(value = "x-guest-id", required = false) String guestId,
            Authentication authentication) {

        Object principal = authentication != null ? authentication.getPrincipal() : null;
        SupportChatResponseDto response = supportChatService.sendMessage(request, principal, guestId);
        return ResponseEntity.ok(response);
    }

    @GetMapping("/conversations")
    public ResponseEntity<List<ConversationSummaryDto>> getStaffConversations(
            @RequestParam(required = false, defaultValue = "30") int limit) {
        
        List<ConversationSummaryDto> response = supportChatService.getConversations(limit);
        return ResponseEntity.ok(response);
    }

    @PatchMapping("/conversations/{conversationId}")
    public ResponseEntity<SupportChatResponseDto> updateConversation(
            @PathVariable("conversationId") String conversationId,
            @RequestBody(required = false) UpdateConversationRequest request,
            Authentication authentication) {

        Object principal = authentication != null ? authentication.getPrincipal() : null;
        SupportChatResponseDto response = supportChatService.updateConversation(
                conversationId,
                request == null ? new UpdateConversationRequest() : request,
                principal
        );
        return ResponseEntity.ok(response);
    }
}
