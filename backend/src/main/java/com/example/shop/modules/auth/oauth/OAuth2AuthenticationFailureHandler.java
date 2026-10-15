package com.example.shop.modules.auth.oauth;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.oauth2.core.OAuth2AuthenticationException;
import org.springframework.security.web.authentication.AuthenticationFailureHandler;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;

@Component
@RequiredArgsConstructor
@Slf4j
public class OAuth2AuthenticationFailureHandler implements AuthenticationFailureHandler {

    private final OAuth2CookieAuthorizationRequestRepository authRequestRepository;

    @Value("${application.frontend.url:http://localhost:3000}")
    private String frontendUrl;

    @Override
    public void onAuthenticationFailure(
            HttpServletRequest request,
            HttpServletResponse response,
            AuthenticationException exception) throws IOException {
        String error = "oauth_failed";
        if (exception instanceof OAuth2AuthenticationException oauthEx && oauthEx.getError() != null) {
            error = oauthEx.getError().getErrorCode();
            log.warn("OAuth2 login failed: code={} description={} path={}",
                    error, oauthEx.getError().getDescription(), request.getRequestURI(), exception);
        } else {
            log.warn("OAuth2 login failed: {} path={}", exception.getMessage(), request.getRequestURI(), exception);
        }

        String redirectTarget = authRequestRepository.loadFrontendRedirectUri(request);
        authRequestRepository.removeAuthorizationRequestCookies(request, response);
        if (redirectTarget == null || redirectTarget.isBlank()) {
            redirectTarget = frontendUrl.replaceAll("/+$", "") + "/oauth/callback";
        }

        String separator = redirectTarget.contains("?") ? "&" : "?";
        response.sendRedirect(redirectTarget + separator + "success=0&error="
                + URLEncoder.encode(error, StandardCharsets.UTF_8));
    }
}
