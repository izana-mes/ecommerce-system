package com.example.shop.modules.auth.controller;

import com.example.shop.common.response.ApiResponse;
import com.example.shop.modules.role.entity.Role;
import com.example.shop.modules.user.entity.User;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/auth")
@RequiredArgsConstructor
public class AuthMeController {

    @GetMapping("/me")
    public ResponseEntity<ApiResponse<Map<String, Object>>> me(@AuthenticationPrincipal User user) {
        if (user == null) {
            return ResponseEntity.ok(ApiResponse.success(null, "Not authenticated"));
        }
        List<String> roles = user.getRoles() == null
                ? Collections.emptyList()
                : user.getRoles().stream()
                .map(Role::getName)
                .toList();
        String normalizedRole = roles.stream().anyMatch("ROLE_ADMIN"::equalsIgnoreCase)
                ? "admin"
                : roles.stream().anyMatch("ROLE_EMPLOYEE"::equalsIgnoreCase) ? "employee" : "user";
        Map<String, Object> data = new HashMap<>();
        data.put("id", user.getId());
        data.put("email", user.getEmail());
        data.put("firstName", user.getFirstName());
        data.put("lastName", user.getLastName());
        data.put("roles", roles);
        data.put("role", normalizedRole);
        return ResponseEntity.ok(ApiResponse.success(data));
    }
}
