package com.example.shop.modules.auth.oauth;

import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.security.oauth2.client.web.AuthorizationRequestRepository;
import org.springframework.security.oauth2.core.endpoint.OAuth2AuthorizationRequest;
import org.springframework.stereotype.Component;

import java.util.Base64;

@Component
public class OAuth2CookieAuthorizationRequestRepository implements AuthorizationRequestRepository<OAuth2AuthorizationRequest> {

    private static final String COOKIE_NAME = "OAUTH2_AUTH_REQUEST";
    private static final String FRONTEND_REDIRECT_URI_COOKIE_NAME = "OAUTH2_FRONTEND_REDIRECT_URI";
    private static final int COOKIE_EXPIRE_SECONDS = 180;

    @Override
    public OAuth2AuthorizationRequest loadAuthorizationRequest(HttpServletRequest request) {
        Cookie cookie = getCookie(request, COOKIE_NAME);
        if (cookie == null) return null;
        return deserialize(cookie.getValue());
    }

    @Override
    public void saveAuthorizationRequest(OAuth2AuthorizationRequest authorizationRequest, HttpServletRequest request, HttpServletResponse response) {
        if (authorizationRequest == null) {
            removeAuthorizationRequestCookies(request, response);
            return;
        }
        String value = serialize(authorizationRequest);
        addCookie(response, COOKIE_NAME, value, COOKIE_EXPIRE_SECONDS);

        String frontendRedirectUri = request.getParameter("frontend_redirect_uri");
        if (isValidFrontendRedirectUri(frontendRedirectUri)) {
            addCookie(response, FRONTEND_REDIRECT_URI_COOKIE_NAME, serialize(frontendRedirectUri), COOKIE_EXPIRE_SECONDS);
        } else {
            deleteCookie(response, FRONTEND_REDIRECT_URI_COOKIE_NAME);
        }
    }

    @Override
    public OAuth2AuthorizationRequest removeAuthorizationRequest(HttpServletRequest request, HttpServletResponse response) {
        OAuth2AuthorizationRequest authRequest = loadAuthorizationRequest(request);
        removeAuthorizationRequestCookies(request, response);
        return authRequest;
    }

    public void removeAuthorizationRequestCookies(HttpServletRequest request, HttpServletResponse response) {
        deleteCookie(response, COOKIE_NAME);
        deleteCookie(response, FRONTEND_REDIRECT_URI_COOKIE_NAME);
    }

    public String loadFrontendRedirectUri(HttpServletRequest request) {
        Cookie cookie = getCookie(request, FRONTEND_REDIRECT_URI_COOKIE_NAME);
        if (cookie == null || cookie.getValue() == null || cookie.getValue().isBlank()) {
            return null;
        }

        try {
            return deserializeString(cookie.getValue());
        } catch (IllegalArgumentException ex) {
            return null;
        }
    }

    private static void addCookie(HttpServletResponse response, String name, String value, int maxAgeSeconds) {
        Cookie cookie = new Cookie(name, value);
        cookie.setPath("/");
        cookie.setHttpOnly(true);
        cookie.setMaxAge(maxAgeSeconds);
        response.addCookie(cookie);
    }

    private static void deleteCookie(HttpServletResponse response, String name) {
        Cookie cookie = new Cookie(name, "");
        cookie.setPath("/");
        cookie.setHttpOnly(true);
        cookie.setMaxAge(0);
        response.addCookie(cookie);
    }

    private static Cookie getCookie(HttpServletRequest request, String name) {
        Cookie[] cookies = request.getCookies();
        if (cookies == null) return null;
        for (Cookie c : cookies) {
            if (name.equals(c.getName())) return c;
        }
        return null;
    }

    private static String serialize(OAuth2AuthorizationRequest obj) {
        byte[] bytes = SerializationUtils.serialize(obj);
        return Base64.getUrlEncoder().encodeToString(bytes);
    }

    private static String serialize(String value) {
        return Base64.getUrlEncoder().encodeToString(value.getBytes(java.nio.charset.StandardCharsets.UTF_8));
    }

    private static OAuth2AuthorizationRequest deserialize(String str) {
        byte[] bytes = Base64.getUrlDecoder().decode(str);
        return (OAuth2AuthorizationRequest) SerializationUtils.deserialize(bytes);
    }

    private static String deserializeString(String str) {
        byte[] bytes = Base64.getUrlDecoder().decode(str);
        return new String(bytes, java.nio.charset.StandardCharsets.UTF_8);
    }

    private static boolean isValidFrontendRedirectUri(String value) {
        if (value == null || value.isBlank()) {
            return false;
        }

        try {
            java.net.URI uri = java.net.URI.create(value);
            String scheme = uri.getScheme();
            return ("http".equalsIgnoreCase(scheme) || "https".equalsIgnoreCase(scheme)) && uri.getHost() != null;
        } catch (IllegalArgumentException ex) {
            return false;
        }
    }
}
