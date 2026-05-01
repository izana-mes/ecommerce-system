package com.example.shop.modules.auth.oauth;

import com.example.shop.modules.auth.security.AccessTokenCookieWriter;
import com.example.shop.modules.auth.security.JwtProvider;
import com.example.shop.modules.role.entity.Role;
import com.example.shop.modules.role.repository.RoleRepository;
import com.example.shop.modules.user.entity.User;
import com.example.shop.modules.user.repository.UserRepository;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.security.web.authentication.AuthenticationSuccessHandler;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.List;

@Component
@RequiredArgsConstructor
@Slf4j
public class OAuth2AuthenticationSuccessHandler implements AuthenticationSuccessHandler {

    private final UserRepository userRepository;
    private final RoleRepository roleRepository;
    private final JwtProvider jwtProvider;
    private final OAuth2CookieAuthorizationRequestRepository authRequestRepository;
    private final AccessTokenCookieWriter accessTokenCookieWriter;

    @Value("${application.frontend.url:http://localhost:3000}")
    private String frontendUrl;

    @Override
    public void onAuthenticationSuccess(HttpServletRequest request, HttpServletResponse response, Authentication authentication)
            throws IOException, ServletException {

        OAuth2User oauthUser = (OAuth2User) authentication.getPrincipal();

        String email = oauthUser.getAttribute("email");
        Boolean emailVerified = oauthUser.getAttribute("email_verified");
        String sub = oauthUser.getAttribute("sub"); // Google stable user id
        String givenName = oauthUser.getAttribute("given_name");
        String familyName = oauthUser.getAttribute("family_name");
        String redirectTarget = resolveRedirectTarget(request);

        log.info("OAuth2 login success: email={}, sub={}, redirectTarget={}", email, sub, redirectTarget);

        if (email == null || email.isBlank() || sub == null || sub.isBlank()) {
            log.warn("OAuth2 success but missing critical attributes: email={}, sub={}", email, sub);
            response.sendRedirect(redirectTarget + "?success=0&error=missing_email");
            return;
        }

        // Upsert/link
        User user = userRepository.findByAuthProviderAndProviderId("GOOGLE", sub)
                .or(() -> userRepository.findByEmail(email))
                .map(existing -> {
                    log.debug("Linking Google account to existing user: {}", email);
                    return linkGoogle(existing, sub, givenName, familyName, emailVerified);
                })
                .orElseGet(() -> {
                    log.info("Creating new Google user: {}", email);
                    return createGoogleUser(email, sub, givenName, familyName, emailVerified);
                });

        String jwt = jwtProvider.generateAccessToken(user);
        accessTokenCookieWriter.addCookie(request, response, jwt);

        // Fragment is not sent to the frontend server; needed when the SPA is on a different
        // origin than the API (e.g. Vercel + Render) because the HttpOnly cookie stays on the API host.
        String successUrl = redirectTarget.contains("?")
                ? redirectTarget + "&success=1"
                : redirectTarget + "?success=1";
        String encodedToken = URLEncoder.encode(jwt, StandardCharsets.UTF_8);
        String finalRedirect = successUrl + "#access_token=" + encodedToken;
        log.info("Redirecting to frontend: {}", finalRedirect);
        response.sendRedirect(finalRedirect);
    }

    private User linkGoogle(User user, String sub, String givenName, String familyName, Boolean emailVerified) {
        if (user.getAuthProvider() == null) {
            user.setAuthProvider("LOCAL");
        }
        user.setProviderId(sub);
        user.setAuthProvider("GOOGLE");
        if (Boolean.TRUE.equals(emailVerified)) {
            user.setEmailVerified(true);
        }
        if (user.getFirstName() == null && givenName != null) user.setFirstName(givenName);
        if (user.getLastName() == null && familyName != null) user.setLastName(familyName);
        return userRepository.save(user);
    }

    private User createGoogleUser(String email, String sub, String givenName, String familyName, Boolean emailVerified) {
        Role userRole = roleRepository.findByName("ROLE_USER")
                .orElseGet(() -> roleRepository.save(Role.builder().name("ROLE_USER").build()));

        User user = User.builder()
                .email(email)
                .password("oauth2") // not used for OAuth accounts
                .firstName(givenName)
                .lastName(familyName)
                .roles(List.of(userRole))
                .isActive(true)
                .isEmailVerified(Boolean.TRUE.equals(emailVerified))
                .authProvider("GOOGLE")
                .providerId(sub)
                .build();

        // Ensure verified true for Google regardless (policy choice)
        user.setEmailVerified(true);
        return userRepository.save(user);
    }

    private String resolveRedirectTarget(HttpServletRequest request) {
        String requestedRedirectUri = authRequestRepository.loadFrontendRedirectUri(request);
        if (isValidRedirectUri(requestedRedirectUri)) {
            return requestedRedirectUri;
        }

        return frontendUrl.replaceAll("/+$", "") + "/oauth/callback";
    }

    private boolean isValidRedirectUri(String value) {
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
