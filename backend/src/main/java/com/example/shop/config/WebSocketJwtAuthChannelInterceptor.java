package com.example.shop.config;

import com.example.shop.modules.auth.security.JwtProvider;
import com.example.shop.modules.auth.security.AccessTokenRevocationService;
import com.example.shop.modules.auth.security.AuthAbuseProtectionService;
import com.example.shop.modules.user.entity.User;
import com.example.shop.modules.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.ChannelInterceptor;
import org.springframework.messaging.support.MessageHeaderAccessor;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

@Component
@RequiredArgsConstructor
@Slf4j
public class WebSocketJwtAuthChannelInterceptor implements ChannelInterceptor {

    private final JwtProvider jwtProvider;
    private final UserDetailsService userDetailsService;
    private final AccessTokenRevocationService accessTokenRevocationService;
    private final AuthAbuseProtectionService abuseProtectionService;
    private final UserRepository userRepository;
    private final WebSocketSessionRegistry webSocketSessionRegistry;

    @Override
    public Message<?> preSend(Message<?> message, MessageChannel channel) {
        StompHeaderAccessor accessor = MessageHeaderAccessor.getAccessor(message, StompHeaderAccessor.class);
        if (accessor == null || accessor.getCommand() == null) {
            return message;
        }

        if (StompCommand.CONNECT.equals(accessor.getCommand())) {
            String authHeader = firstNonBlank(
                    accessor.getFirstNativeHeader("Authorization"),
                    accessor.getFirstNativeHeader("authorization")
            );
            String requestId = firstNonBlank(
                    accessor.getFirstNativeHeader("X-Request-Id"),
                    accessor.getFirstNativeHeader("x-request-id")
            );
            String ip = firstNonBlank(
                    accessor.getFirstNativeHeader("X-Forwarded-For"),
                    accessor.getFirstNativeHeader("x-forwarded-for")
            );
            String deviceId = firstNonBlank(
                    accessor.getFirstNativeHeader("X-Device-Id"),
                    accessor.getFirstNativeHeader("x-device-id")
            );
            String token = extractBearerToken(authHeader);

            if (StringUtils.hasText(token)) {
                try {
                    JwtProvider.AccessTokenParsed parsed = jwtProvider.parseAccessToken(token);
                    abuseProtectionService.assertWebSocketConnectAllowed(parsed.subject(), ip);
                    if (parsed.jti() == null || parsed.jti().isBlank() || accessTokenRevocationService.isRevoked(parsed.jti(), requestId)) {
                        abuseProtectionService.recordWebSocketConnectFailure(parsed.subject(), ip, "TOKEN_REVOKED");
                        return message;
                    }
                    String username = parsed.subject();
                    UserDetails user = userDetailsService.loadUserByUsername(username);
                    if (jwtProvider.isTokenValid(token, user)) {
                        User principalUser = userRepository.findByEmailIgnoreCase(username).orElse(null);
                        UsernamePasswordAuthenticationToken authentication =
                                new UsernamePasswordAuthenticationToken(user, null, user.getAuthorities());
                        String userId = principalUser == null || principalUser.getId() == null ? null : String.valueOf(principalUser.getId());
                        authentication.setDetails(new WebSocketSessionRegistry.AuthContext(
                                userId,
                                username,
                                parsed.jti(),
                                parsed.sessionId(),
                                parsed.familyId(),
                                firstNonBlank(parsed.deviceId(), deviceId),
                                requestId
                        ));
                        accessor.setUser(authentication);
                        if (accessor.getSessionId() != null) {
                            webSocketSessionRegistry.registerAuthContext(accessor.getSessionId(), (WebSocketSessionRegistry.AuthContext) authentication.getDetails());
                        }
                        abuseProtectionService.recordWebSocketConnectSuccess(username, ip);
                    } else {
                        abuseProtectionService.recordWebSocketConnectFailure(username, ip, "JWT_INVALID");
                    }
                } catch (Exception ex) {
                    abuseProtectionService.recordWebSocketConnectFailure("unknown", ip, "AUTH_EXCEPTION");
                    log.warn("WebSocket CONNECT token rejected: {}", ex.getMessage());
                }
            } else {
                abuseProtectionService.recordWebSocketConnectFailure("unknown", ip, "TOKEN_MISSING");
            }
        }

        return message;
    }

    private String extractBearerToken(String authHeader) {
        if (!StringUtils.hasText(authHeader)) {
            return null;
        }
        String value = authHeader.trim();
        if (value.regionMatches(true, 0, "Bearer ", 0, 7)) {
            return value.substring(7).trim();
        }
        return value;
    }

    private String firstNonBlank(String first, String second) {
        if (StringUtils.hasText(first)) {
            return first;
        }
        return StringUtils.hasText(second) ? second : null;
    }
}
