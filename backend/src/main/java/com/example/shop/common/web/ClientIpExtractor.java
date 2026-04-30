package com.example.shop.common.web;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

import java.util.Arrays;
import java.util.HashSet;
import java.util.Optional;
import java.util.Set;

/**
 * Extracts client IP while avoiding trusting spoofable proxy headers by default.
 * <p>
 * If the immediate peer (remoteAddr) is a trusted proxy, we will honor X-Forwarded-For / X-Real-IP.
 * Otherwise, we fall back to request.getRemoteAddr().
 */
@Component
public class ClientIpExtractor {

    private final Set<String> trustedProxyAddrs;

    public ClientIpExtractor(@Value("${application.security.trusted-proxies:}") String trustedProxies) {
        Set<String> values = new HashSet<>();
        values.add("127.0.0.1");
        values.add("::1");
        if (StringUtils.hasText(trustedProxies)) {
            Arrays.stream(trustedProxies.split(","))
                    .map(String::trim)
                    .filter(StringUtils::hasText)
                    .forEach(values::add);
        }
        this.trustedProxyAddrs = Set.copyOf(values);
    }

    public String extractClientIp(HttpServletRequest request) {
        String remoteAddr = request.getRemoteAddr();
        if (!isTrustedProxy(remoteAddr)) {
            return remoteAddr;
        }

        String forwardedFor = request.getHeader("X-Forwarded-For");
        if (StringUtils.hasText(forwardedFor)) {
            return Optional.of(forwardedFor.split(","))
                    .map(parts -> parts[0].trim())
                    .filter(StringUtils::hasText)
                    .orElse(remoteAddr);
        }

        String realIp = request.getHeader("X-Real-IP");
        if (StringUtils.hasText(realIp)) {
            return realIp.trim();
        }

        return remoteAddr;
    }

    private boolean isTrustedProxy(String remoteAddr) {
        if (!StringUtils.hasText(remoteAddr)) {
            return false;
        }
        return trustedProxyAddrs.contains(remoteAddr.trim());
    }
}

