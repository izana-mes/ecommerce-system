package com.example.shop.modules.chatbot.controller;

import com.example.shop.modules.chatbot.service.StaffChatbotService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.util.StringUtils;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.util.Map;

/**
 * Staff/admin chatbot endpoint — requires ROLE_ADMIN or ROLE_STAFF/ROLE_EMPLOYEE.
 * Proxied by the Next.js frontend at /api/chatbot/ask → /api/chatbot/staff/ask (backend).
 */
@RestController
@RequestMapping("/api/chatbot")
@RequiredArgsConstructor
public class StaffChatbotController {

    private final StaffChatbotService staffChatbotService;

    @PostMapping("/staff/ask")
    @PreAuthorize("hasAnyRole('ADMIN', 'STAFF', 'EMPLOYEE')")
    public ResponseEntity<?> staffAsk(@RequestBody Map<String, String> body) {
        String question = body == null ? null : body.get("question");
        if (!StringUtils.hasText(question)) {
            return ResponseEntity.badRequest().body(Map.of("error", "question is required"));
        }

        try {
            StaffChatbotService.ChatResult result = staffChatbotService.buildAnswer(question.trim());
            return ResponseEntity.ok(Map.of(
                    "question", question.trim(),
                    "intent", result.intent(),
                    "answer", result.answer()
            ));
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(Map.of(
                    "error", "Failed to answer question",
                    "details", e.getMessage() != null ? e.getMessage() : "Unknown error"
            ));
        }
    }

    @PostMapping("/staff/stream")
    @PreAuthorize("hasAnyRole('ADMIN', 'STAFF', 'EMPLOYEE')")
    public SseEmitter staffAskStream(@RequestBody Map<String, String> body) {
        SseEmitter emitter = new SseEmitter(60_000L);
        String question = body == null ? null : body.get("question");
        if (!StringUtils.hasText(question)) {
            emitter.completeWithError(new IllegalArgumentException("question is required"));
            return emitter;
        }
        try {
            StaffChatbotService.ChatResult result = staffChatbotService.buildAnswer(question.trim());
            String[] chunks = result.answer().split("\\s+");
            for (String chunk : chunks) {
                emitter.send(SseEmitter.event().name("token").data(Map.of("token", chunk + " ")));
            }
            emitter.send(SseEmitter.event().name("done").data(Map.of("done", true)));
            emitter.complete();
        } catch (Exception e) {
            emitter.completeWithError(e);
        }
        return emitter;
    }
}
