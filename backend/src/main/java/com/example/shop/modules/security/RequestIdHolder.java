package com.example.shop.modules.security;

import org.slf4j.MDC;

public final class RequestIdHolder {
    public static final String MDC_KEY = "requestId";

    private RequestIdHolder() {
    }

    public static String getOrDefault() {
        String value = MDC.get(MDC_KEY);
        return value == null || value.isBlank() ? "unknown" : value;
    }
}
