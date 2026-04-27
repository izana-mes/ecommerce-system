package com.example.shop.modules.user.dto.response;

import com.example.shop.modules.user.entity.User;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * Lightweight DTO for user lists - contains only essential public info.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UserSummaryResponse {

    private UUID id;
    private String email;
    private String firstName;
    private String lastName;
    private boolean active;
    private String role;
    private List<String> roles;

    public static UserSummaryResponse fromEntity(User user) {
        List<String> roles = user.getRoles() == null
                ? List.of()
                : user.getRoles().stream()
                .map(role -> role.getName())
                .collect(Collectors.toList());

        String normalizedRole = roles.stream().anyMatch("ROLE_ADMIN"::equalsIgnoreCase)
                ? "admin"
                : roles.stream().anyMatch("ROLE_EMPLOYEE"::equalsIgnoreCase) ? "employee"
                : roles.stream().anyMatch("ROLE_SUPPLIER"::equalsIgnoreCase) ? "supplier"
                : "user";

        return UserSummaryResponse.builder()
                .id(user.getId())
                .email(user.getEmail())
                .firstName(user.getFirstName())
                .lastName(user.getLastName())
                .active(user.isActive())
                .role(normalizedRole)
                .roles(roles)
                .build();
    }
}
