package com.example.shop.modules.ai.controller;

import com.example.shop.modules.ai.dto.*;
import com.example.shop.modules.ai.service.*;
import com.example.shop.modules.user.entity.User;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import java.util.Map;

@RestController @RequestMapping("/api/ai") @RequiredArgsConstructor
public class AiAssistantController {
 private final AiAssistantService assistant; private final AiRateLimitService rate; private final AiConversationService conversations;
 @PostMapping("/ask") public ResponseEntity<?> ask(@Valid @RequestBody AiChatRequest request,@AuthenticationPrincipal User user,HttpServletRequest http){String identity=user!=null?user.getId().toString():http.getRemoteAddr();if(!rate.allow(identity))return ResponseEntity.status(429).body(Map.of("error","Too many AI requests. Please try again shortly."));try{return ResponseEntity.ok(assistant.ask(request,user));}catch(AccessDeniedException e){return ResponseEntity.status(403).body(Map.of("error","You are not allowed to access that information."));}catch(IllegalArgumentException e){return ResponseEntity.badRequest().body(Map.of("error","Invalid AI request."));}catch(Exception e){return ResponseEntity.status(503).body(Map.of("error","The AI assistant is temporarily unavailable."));}}
 @GetMapping("/conversations") public ResponseEntity<?> list(@AuthenticationPrincipal User user){try{return ResponseEntity.ok(conversations.list(user,audience(user)));}catch(AccessDeniedException e){return ResponseEntity.status(403).body(Map.of("error","Sign in is required."));}}
 @GetMapping("/conversations/{id}") public ResponseEntity<?> get(@PathVariable String id,@AuthenticationPrincipal User user){try{return ResponseEntity.ok(conversations.get(id,user,audience(user)));}catch(AccessDeniedException e){return ResponseEntity.status(404).body(Map.of("error","Conversation not found."));}}
 @DeleteMapping("/conversations/{id}") public ResponseEntity<?> delete(@PathVariable String id,@AuthenticationPrincipal User user){try{conversations.delete(id,user,audience(user));return ResponseEntity.noContent().build();}catch(AccessDeniedException e){return ResponseEntity.status(404).body(Map.of("error","Conversation not found."));}}
 private String audience(User user){return user!=null&&user.getAuthorities().stream().anyMatch(a->"ROLE_ADMIN".equals(a.getAuthority()))?"ADMIN":"CUSTOMER";}
}
