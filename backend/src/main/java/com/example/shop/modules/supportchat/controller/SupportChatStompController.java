package com.example.shop.modules.supportchat.controller;

import com.example.shop.modules.supportchat.dto.SendMessageRequest;
import com.example.shop.modules.supportchat.service.SupportChatService;
import lombok.RequiredArgsConstructor;
import org.springframework.messaging.handler.annotation.Header;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.stereotype.Controller;

import java.security.Principal;

@Controller
@RequiredArgsConstructor
public class SupportChatStompController {

    private final SupportChatService supportChatService;

    @MessageMapping("/support-chat.send")
    public void sendMessage(
            SendMessageRequest request,
            @Header(name = "x-guest-id", required = false) String guestId,
            Principal principal) {

        Object actor = principal;
        if (principal instanceof org.springframework.security.core.Authentication authentication) {
            actor = authentication.getPrincipal();
        }
        supportChatService.sendMessage(request, actor, guestId);
    }
}
