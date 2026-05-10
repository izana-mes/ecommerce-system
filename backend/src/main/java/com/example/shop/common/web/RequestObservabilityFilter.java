package com.example.shop.common.web;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.extern.slf4j.Slf4j;
import org.slf4j.MDC;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import org.springframework.web.filter.OncePerRequestFilter;
import org.springframework.web.context.request.async.AsyncRequestNotUsableException;

import java.io.IOException;
import java.util.UUID;

@Component
@Slf4j
public class RequestObservabilityFilter extends OncePerRequestFilter {

    private static final String REQUEST_ID_HEADER = "X-Request-Id";
    private static final String REQUEST_ID_MDC_KEY = "requestId";
    private final ClientIpExtractor clientIpExtractor;

    public RequestObservabilityFilter(ClientIpExtractor clientIpExtractor) {
        this.clientIpExtractor = clientIpExtractor;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {
        long startedAt = System.currentTimeMillis();
        String requestId = resolveRequestId(request);
        MDC.put(REQUEST_ID_MDC_KEY, requestId);
        response.setHeader(REQUEST_ID_HEADER, requestId);

        try {
            filterChain.doFilter(request, response);
        } catch (Exception ex) {
            if (isClientDisconnect(ex)) {
                log.warn("client_disconnect requestId={} method={} path={} details=\"{}\"",
                        requestId, request.getMethod(), request.getRequestURI(), rootMessage(ex));
                return;
            }
            throw ex;
        } finally {
            long durationMs = Math.max(0L, System.currentTimeMillis() - startedAt);
            int status = response.getStatus();
            String method = request.getMethod();
            String path = request.getRequestURI();
            String clientIp = clientIpExtractor.extractClientIp(request);
            String actor = resolveActor();
            String userAgent = sanitize(request.getHeader("User-Agent"));

            if (status >= 500) {
                log.error("http_request requestId={} method={} path={} status={} durationMs={} ip={} actor={} ua=\"{}\"",
                        requestId, method, path, status, durationMs, clientIp, actor, userAgent);
            } else {
                log.info("http_request requestId={} method={} path={} status={} durationMs={} ip={} actor={} ua=\"{}\"",
                        requestId, method, path, status, durationMs, clientIp, actor, userAgent);
            }

            MDC.remove(REQUEST_ID_MDC_KEY);
        }
    }

    private boolean isClientDisconnect(Exception ex) {
        if (ex instanceof AsyncRequestNotUsableException) {
            return true;
        }
        Throwable current = ex;
        while (current != null) {
            String className = current.getClass().getName();
            if ("org.apache.catalina.connector.ClientAbortException".equals(className)) {
                return true;
            }
            if (current instanceof IOException) {
                String message = current.getMessage();
                if (message != null) {
                    String normalized = message.toLowerCase();
                    if (normalized.contains("broken pipe") || normalized.contains("connection reset by peer")) {
                        return true;
                    }
                }
            }
            current = current.getCause();
        }
        for (Throwable suppressed : ex.getSuppressed()) {
            String className = suppressed.getClass().getName();
            if ("org.apache.catalina.connector.ClientAbortException".equals(className)) {
                return true;
            }
        }
        return false;
    }

    private String rootMessage(Exception ex) {
        Throwable current = ex;
        String last = ex.getMessage();
        while (current != null) {
            if (current.getMessage() != null && !current.getMessage().isBlank()) {
                last = current.getMessage();
            }
            current = current.getCause();
        }
        return last == null ? "unknown" : last;
    }

    private String resolveRequestId(HttpServletRequest request) {
        String incoming = request.getHeader(REQUEST_ID_HEADER);
        if (StringUtils.hasText(incoming)) {
            return incoming.trim();
        }
        return UUID.randomUUID().toString();
    }

    private String resolveActor() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !authentication.isAuthenticated()) {
            return "anonymous";
        }
        return sanitize(String.valueOf(authentication.getName()));
    }

    private String sanitize(String value) {
        if (!StringUtils.hasText(value)) {
            return "";
        }
        return value.replace("\"", "'");
    }
}
