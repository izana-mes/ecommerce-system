package com.example.shop.modules.notification.controller;

import com.example.shop.modules.notification.service.CustomerNotificationService;
import com.example.shop.modules.user.entity.User;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import java.util.Map;

@RestController @RequestMapping("/api/v1/notifications") @RequiredArgsConstructor
@PreAuthorize("isAuthenticated()")
public class CustomerNotificationController {
    private final CustomerNotificationService service;
    @GetMapping public ResponseEntity<Map<String,Object>> list(@AuthenticationPrincipal User user) { return ResponseEntity.ok(service.list(user.getId())); }
    @PatchMapping("/{id}/read") public ResponseEntity<Void> read(@PathVariable Long id, @AuthenticationPrincipal User user) { service.markRead(id,user.getId()); return ResponseEntity.noContent().build(); }
    @PatchMapping("/{id}/unread") public ResponseEntity<Void> unread(@PathVariable Long id, @AuthenticationPrincipal User user) { service.markUnread(id,user.getId()); return ResponseEntity.noContent().build(); }
    @PostMapping("/read-all") public ResponseEntity<Void> readAll(@AuthenticationPrincipal User user) { service.markAllRead(user.getId()); return ResponseEntity.noContent().build(); }
}
