package com.example.shop.modules.chatbot.security;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.Map;

/**
 * Guards all /api/chatbot/tools/** endpoints with a shared secret token.
 * The MCP Server presents this token via the X-MCP-Service-Token header.
 * This is intentionally separate from user JWTs — it grants trusted internal service access.
 */
@Component
@Slf4j
public class McpServiceTokenFilter extends OncePerRequestFilter {

    private static final String TOKEN_HEADER = "X-MCP-Service-Token";
    private static final String TOOLS_PATH = "/api/chatbot/tools/";

    private final String serviceToken;
    private final ObjectMapper objectMapper;

    public McpServiceTokenFilter(
            @Value("${application.mcp.service-token:}") String serviceToken,
            ObjectMapper objectMapper
    ) {
        this.serviceToken = serviceToken == null ? "" : serviceToken.trim();
        this.objectMapper = objectMapper;
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        // Only intercept /api/chatbot/tools/** paths
        String path = request.getRequestURI();
        return !path.contains(TOOLS_PATH);
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain filterChain)
            throws ServletException, IOException {

        if (serviceToken.isBlank()) {
            log.error("mcp_service_token_not_configured path={}", request.getRequestURI());
            writeError(response, HttpStatus.INTERNAL_SERVER_ERROR.value(),
                    "MCP service token is not configured on the server");
            return;
        }

        String header = request.getHeader(TOKEN_HEADER);
        if (header == null || !serviceToken.equals(header.trim())) {
            log.warn("mcp_auth_failed method={} path={} ip={}",
                    request.getMethod(), request.getRequestURI(), request.getRemoteAddr());
            writeError(response, HttpStatus.UNAUTHORIZED.value(), "Invalid or missing MCP service token");
            return;
        }

        filterChain.doFilter(request, response);
    }

    private void writeError(HttpServletResponse response, int status, String message) throws IOException {
        response.setStatus(status);
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        response.getWriter().write(objectMapper.writeValueAsString(Map.of(
                "success", false,
                "message", message
        )));
    }
}
