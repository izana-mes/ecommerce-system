package com.example.shop.modules.auth.security;

import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseCookie;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.util.Locale;

/**
 * Sets the JWT access cookie with SameSite=None; Secure when the public API URL is HTTPS,
 * so SPAs on another origin (e.g. Vercel) can call the API with credentials.
 */
@Component
public class AccessTokenCookieWriter {

    @Value("${application.server.url:http://localhost:8080}")
    private String applicationServerUrl;

    @Value("${application.security.auth-cookie.name:access_token}")
    private String cookieName;

    @Value("${application.security.jwt.expiration:86400000}")
    private long jwtExpirationMs;

    public void addCookie(HttpServletRequest request, HttpServletResponse response, String jwt) {
        int maxAgeSeconds = (int) Math.min(jwtExpirationMs / 1000, Integer.MAX_VALUE);
        if (useCrossSiteAuthCookie(request)) {
            ResponseCookie cookie = ResponseCookie.from(cookieName, jwt)
                    .httpOnly(true)
                    .path("/")
                    .maxAge(Duration.ofSeconds(maxAgeSeconds))
                    .sameSite("None")
                    .secure(true)
                    .build();
            response.addHeader(HttpHeaders.SET_COOKIE, cookie.toString());
            return;
        }
        Cookie cookie = new Cookie(cookieName, jwt);
        cookie.setHttpOnly(true);
        cookie.setPath("/");
        cookie.setMaxAge(maxAgeSeconds);
        response.addCookie(cookie);
    }

    private boolean useCrossSiteAuthCookie(HttpServletRequest request) {
        String url = applicationServerUrl == null ? "" : applicationServerUrl.trim().toLowerCase(Locale.ROOT);
        if (url.startsWith("https://")) {
            return true;
        }
        return request.isSecure();
    }
}
