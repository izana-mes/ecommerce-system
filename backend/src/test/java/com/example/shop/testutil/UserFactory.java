package com.example.shop.testutil;

import com.example.shop.modules.user.entity.User;

public final class UserFactory {
    private UserFactory() {}

    public static User basic(String email) {
        return User.builder()
                .email(email)
                .password("encoded-password")
                .firstName("QA")
                .lastName("User")
                .isActive(true)
                .isEmailVerified(true)
                .build();
    }
}
