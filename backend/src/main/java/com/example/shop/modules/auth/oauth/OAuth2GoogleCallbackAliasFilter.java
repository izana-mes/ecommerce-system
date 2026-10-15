package com.example.shop.modules.auth.oauth;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;

/**
 * Google Console often gets a redirect URI of {@code /login}. Spring's OAuth callback is
 * {@code /login/oauth2/code/google}. Forward the alias so the code/state exchange still runs.
 */
public final class OAuth2GoogleCallbackAliasFilter extends OncePerRequestFilter {

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {
        if (isGoogleCallbackOnLoginPath(request)) {
            request.getRequestDispatcher("/login/oauth2/code/google").forward(request, response);
            return;
        }
        filterChain.doFilter(request, response);
    }

    private static boolean isGoogleCallbackOnLoginPath(HttpServletRequest request) {
        return "GET".equalsIgnoreCase(request.getMethod())
                && "/login".equals(request.getRequestURI())
                && request.getParameter("code") != null
                && request.getParameter("state") != null;
    }
}
