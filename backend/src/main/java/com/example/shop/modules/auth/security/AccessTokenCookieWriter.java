package com.example.shop.modules.auth.security;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class AccessTokenCookieWriter {

    private final AuthCookieService authCookieService;

    public void addCookie(HttpServletRequest request, HttpServletResponse response, String jwt) {
        authCookieService.writeAccessCookie(request, response, jwt);
    }
}
