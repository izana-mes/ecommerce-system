package com.example.shop.modules.token.entity;

public enum RefreshTokenRevocationReason {
    ROTATED,
    LOGOUT,
    LOGOUT_ALL,
    REUSE_DETECTED,
    ADMIN_REVOKED,
    PASSWORD_RESET,
    USER_DEACTIVATED,
    EXPIRED
}
