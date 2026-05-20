package com.example.shop.modules.auth.security;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.SignatureAlgorithm;
import io.jsonwebtoken.io.Decoders;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.stereotype.Component;

import javax.crypto.SecretKey;
import java.util.Date;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;
import java.util.function.Function;

/**
 * JWT token provider for the authentication module.
 *
 * What this class does:
 * - Generates access tokens (short-lived JWT) for authenticated users
 * - Validates access tokens and extracts claims (e.g. username)
 * - Uses HS256 signing with a configurable secret
 *
 * Why it exists:
 * - Separates JWT logic from business logic (AuthService) and filter logic (JwtAuthenticationFilter)
 * - Single responsibility: token creation and validation
 * - Can be tested independently
 *
 * Annotations:
 * - @Component: Spring-managed bean, injectable into AuthService and JwtAuthenticationFilter
 *
 * How it interacts:
 * - AuthService: Calls generateAccessToken() after successful login/register
 * - JwtAuthenticationFilter: Calls extractUsername() and isTokenValid() for each request with Bearer token
 * - application.yml: Provides secret-key and expiration
 */
@Component
public class JwtProvider {
    public static final String CLAIM_SESSION_ID = "sid";
    public static final String CLAIM_FAMILY_ID = "fid";
    public static final String CLAIM_DEVICE_ID = "did";

    @Value("${application.security.jwt.secret-key}")
    private String secretKey;

    @Value("${application.security.jwt.expiration}")
    private long accessTokenExpiration;

    /**
     * Extract username (email) from token subject claim.
     */
    public String extractUsername(String token) {
        return extractClaim(token, Claims::getSubject);
    }

    /**
     * Extract any claim using a resolver function.
     */
    public <T> T extractClaim(String token, Function<Claims, T> claimsResolver) {
        Claims claims = extractAllClaims(token);
        return claimsResolver.apply(claims);
    }

    /**
     * Generate access token for user.
     */
    public String generateAccessToken(UserDetails userDetails) {
        return generateAccessToken(new HashMap<>(), userDetails, null);
    }

    /**
     * Generate access token with extra claims.
     */
    public String generateAccessToken(Map<String, Object> extraClaims, UserDetails userDetails) {
        return generateAccessToken(extraClaims, userDetails, null);
    }

    public String generateAccessToken(UserDetails userDetails, AccessTokenContext context) {
        return generateAccessToken(new HashMap<>(), userDetails, context);
    }

    public String generateAccessToken(Map<String, Object> extraClaims, UserDetails userDetails, AccessTokenContext context) {
        Date issuedAt = new Date(System.currentTimeMillis());
        Date expiration = new Date(System.currentTimeMillis() + accessTokenExpiration);
        String jti = UUID.randomUUID().toString();
        Map<String, Object> claims = new HashMap<>(extraClaims);
        if (context != null) {
            putIfNotBlank(claims, CLAIM_SESSION_ID, context.sessionId());
            putIfNotBlank(claims, CLAIM_FAMILY_ID, context.familyId());
            putIfNotBlank(claims, CLAIM_DEVICE_ID, context.deviceId());
        }
        return Jwts.builder()
                .setClaims(claims)
                .setSubject(userDetails.getUsername())
                .setId(jti)
                .setIssuedAt(issuedAt)
                .setExpiration(expiration)
                .signWith(getSignInKey(), SignatureAlgorithm.HS256)
                .compact();
    }

    /**
     * Validate token: correct user and not expired.
     */
    public boolean isTokenValid(String token, UserDetails userDetails) {
        String username = extractUsername(token);
        return username.equals(userDetails.getUsername())
                && userDetails.isEnabled()
                && userDetails.isAccountNonLocked()
                && userDetails.isAccountNonExpired()
                && userDetails.isCredentialsNonExpired()
                && !isTokenExpired(token);
    }

    private boolean isTokenExpired(String token) {
        return extractExpiration(token).before(new Date());
    }

    private Date extractExpiration(String token) {
        return extractClaim(token, Claims::getExpiration);
    }

    private Claims extractAllClaims(String token) {
        return Jwts.parserBuilder()
                .setSigningKey(getSignInKey())
                .build()
                .parseClaimsJws(token)
                .getBody();
    }

    public Claims extractClaims(String token) {
        return extractAllClaims(token);
    }

    public AccessTokenParsed parseAccessToken(String token) {
        Claims claims = extractAllClaims(token);
        return new AccessTokenParsed(
                claims.getSubject(),
                claims.getId(),
                claims.getIssuedAt(),
                claims.getExpiration(),
                claims.get(CLAIM_SESSION_ID, String.class),
                claims.get(CLAIM_FAMILY_ID, String.class),
                claims.get(CLAIM_DEVICE_ID, String.class)
        );
    }

    private void putIfNotBlank(Map<String, Object> claims, String key, String value) {
        if (value != null && !value.isBlank()) {
            claims.put(key, value);
        }
    }

    public record AccessTokenContext(String sessionId, String familyId, String deviceId) {
    }

    public record AccessTokenParsed(
            String subject,
            String jti,
            Date issuedAt,
            Date expiresAt,
            String sessionId,
            String familyId,
            String deviceId
    ) {
    }

    private SecretKey getSignInKey() {
        byte[] keyBytes = Decoders.BASE64.decode(secretKey);
        return Keys.hmacShaKeyFor(keyBytes);
    }
}
