package com.example.shop.modules.auth.security;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseCookie;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

import java.time.Duration;

@Component
public class AuthCookieService {

    @Value("${application.security.auth-cookie.access-name:access_token}")
    private String accessCookieName;

    @Value("${application.security.auth-cookie.refresh-name:refresh_token}")
    private String refreshCookieName;

    @Value("${application.security.auth-cookie.same-site:Lax}")
    private String sameSite;

    @Value("${application.security.auth-cookie.secure:true}")
    private boolean secureCookie;

    @Value("${application.security.auth-cookie.access-path:/}")
    private String accessCookiePath;

    @Value("${application.security.auth-cookie.refresh-path:/api/v1/auth}")
    private String refreshCookiePath;

    @Value("${application.security.jwt.expiration:900000}")
    private long accessTokenExpirationMs;

    @Value("${application.security.jwt.refresh-token.expiration:1209600000}")
    private long refreshTokenExpirationMs;

    public void writeAuthCookies(HttpServletRequest request, HttpServletResponse response, String accessToken, String refreshToken) {
        addCookie(response, accessCookieName, accessToken, accessCookiePath, accessTokenExpirationMs, request.isSecure());
        addCookie(response, refreshCookieName, refreshToken, refreshCookiePath, refreshTokenExpirationMs, request.isSecure());
    }

    public void writeAccessCookie(HttpServletRequest request, HttpServletResponse response, String accessToken) {
        addCookie(response, accessCookieName, accessToken, accessCookiePath, accessTokenExpirationMs, request.isSecure());
    }

    public void clearAuthCookies(HttpServletRequest request, HttpServletResponse response) {
        deleteCookie(response, accessCookieName, accessCookiePath, request.isSecure());
        deleteCookie(response, refreshCookieName, refreshCookiePath, request.isSecure());
    }

    public String readRefreshToken(HttpServletRequest request) {
        if (request.getCookies() == null) {
            return null;
        }
        for (var cookie : request.getCookies()) {
            if (refreshCookieName.equals(cookie.getName()) && StringUtils.hasText(cookie.getValue())) {
                return cookie.getValue();
            }
        }
        return null;
    }

    private void addCookie(HttpServletResponse response, String name, String value, String path, long maxAgeMs, boolean requestSecure) {
        ResponseCookie cookie = ResponseCookie.from(name, value)
                .httpOnly(true)
                .secure(secureCookie || requestSecure)
                .sameSite(sameSite)
                .path(path)
                .maxAge(Duration.ofMillis(maxAgeMs))
                .build();
        response.addHeader(HttpHeaders.SET_COOKIE, cookie.toString());
    }

    private void deleteCookie(HttpServletResponse response, String name, String path, boolean requestSecure) {
        ResponseCookie cookie = ResponseCookie.from(name, "")
                .httpOnly(true)
                .secure(secureCookie || requestSecure)
                .sameSite(sameSite)
                .path(path)
                .maxAge(Duration.ZERO)
                .build();
        response.addHeader(HttpHeaders.SET_COOKIE, cookie.toString());
    }
}
