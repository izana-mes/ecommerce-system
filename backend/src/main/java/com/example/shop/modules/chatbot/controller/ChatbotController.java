package com.example.shop.modules.chatbot.controller;

import com.example.shop.modules.chatbot.service.ChatbotService;
import com.example.shop.modules.user.entity.User;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.util.StringUtils;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/chatbot")
@RequiredArgsConstructor
public class ChatbotController {

    private final ChatbotService chatbotService;

    /**
     * Public endpoint — no authentication required.
     * Authenticated users get richer order lookup (email inferred from token).
     */
    @PostMapping("/customer/ask")
    public ResponseEntity<?> customerAsk(
            @RequestBody Map<String, String> body,
            @AuthenticationPrincipal User currentUser
    ) {
        String question = body == null ? null : body.get("question");
        if (!StringUtils.hasText(question)) {
            return ResponseEntity.badRequest().body(Map.of("error", "question is required"));
        }

        String userEmail = currentUser != null ? currentUser.getEmail() : null;

        try {
            ChatbotService.ChatResult result = chatbotService.buildAnswer(question.trim(), userEmail);
            return ResponseEntity.ok(Map.of(
                    "question", question.trim(),
                    "intent", result.intent(),
                    "answer", result.answer(),
                    "authenticated", userEmail != null
            ));
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(Map.of(
                    "error", "Failed to answer question",
                    "details", e.getMessage() != null ? e.getMessage() : "Unknown error"
            ));
        }
    }
}
