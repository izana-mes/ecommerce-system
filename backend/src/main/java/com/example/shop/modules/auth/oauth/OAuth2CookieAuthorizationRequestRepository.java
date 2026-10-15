package com.example.shop.modules.auth.oauth;

import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseCookie;
import org.springframework.security.oauth2.client.web.AuthorizationRequestRepository;
import org.springframework.security.oauth2.core.endpoint.OAuth2AuthorizationRequest;
import org.springframework.stereotype.Component;

import lombok.extern.slf4j.Slf4j;
import java.util.Base64;

@Component
@Slf4j
public class OAuth2CookieAuthorizationRequestRepository implements AuthorizationRequestRepository<OAuth2AuthorizationRequest> {

    private static final String COOKIE_NAME = "OAUTH2_AUTH_REQUEST";
    private static final String FRONTEND_REDIRECT_URI_COOKIE_NAME = "OAUTH2_FRONTEND_REDIRECT_URI";
    private static final int COOKIE_EXPIRE_SECONDS = 180;

    @Override
    public OAuth2AuthorizationRequest loadAuthorizationRequest(HttpServletRequest request) {
        log.debug("loadAuthorizationRequest path={}", request.getRequestURI());
        Cookie cookie = getCookie(request, COOKIE_NAME);
        if (cookie == null) {
            log.debug("loadAuthorizationRequest: cookie not found");
            return null;
        }
        try {
            return deserialize(cookie.getValue());
        } catch (Exception e) {
            log.error("Failed to deserialize OAuth2AuthorizationRequest from cookie", e);
            return null;
        }
    }

    @Override
    public void saveAuthorizationRequest(OAuth2AuthorizationRequest authorizationRequest, HttpServletRequest request, HttpServletResponse response) {
        if (authorizationRequest == null) {
            log.debug("saveAuthorizationRequest: null request, removing cookies");
            removeAuthorizationRequestCookies(request, response);
            return;
        }
        
        log.debug("saveAuthorizationRequest: saving request for state={}", authorizationRequest.getState());
        String value = serialize(authorizationRequest);
        addCookie(request, response, COOKIE_NAME, value, COOKIE_EXPIRE_SECONDS);

        String frontendRedirectUri = request.getParameter("frontend_redirect_uri");
        log.debug("saveAuthorizationRequest: frontend_redirect_uri={}", frontendRedirectUri);
        if (isValidFrontendRedirectUri(frontendRedirectUri)) {
            addCookie(request, response, FRONTEND_REDIRECT_URI_COOKIE_NAME, serialize(frontendRedirectUri), COOKIE_EXPIRE_SECONDS);
        } else {
            deleteCookie(request, response, FRONTEND_REDIRECT_URI_COOKIE_NAME);
        }
    }

    @Override
    public OAuth2AuthorizationRequest removeAuthorizationRequest(HttpServletRequest request, HttpServletResponse response) {
        log.debug("removeAuthorizationRequest path={}", request.getRequestURI());
        OAuth2AuthorizationRequest authRequest = loadAuthorizationRequest(request);
        removeAuthorizationRequestCookies(request, response);
        return authRequest;
    }

    public void removeAuthorizationRequestCookies(HttpServletRequest request, HttpServletResponse response) {
        deleteCookie(request, response, COOKIE_NAME);
        deleteCookie(request, response, FRONTEND_REDIRECT_URI_COOKIE_NAME);
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

    private static void addCookie(
            HttpServletRequest request, HttpServletResponse response, String name, String value, int maxAgeSeconds) {
        response.addHeader(HttpHeaders.SET_COOKIE, cookieBuilder(request, name, value, maxAgeSeconds).toString());
    }

    private static void deleteCookie(HttpServletRequest request, HttpServletResponse response, String name) {
        response.addHeader(HttpHeaders.SET_COOKIE, cookieBuilder(request, name, "", 0).toString());
    }

    private static ResponseCookie cookieBuilder(HttpServletRequest request, String name, String value, int maxAgeSeconds) {
        return ResponseCookie.from(name, value)
                .path("/")
                .httpOnly(true)
                .maxAge(maxAgeSeconds)
                .sameSite("Lax")
                .secure(request.isSecure())
                .build();
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
