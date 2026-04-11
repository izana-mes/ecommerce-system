package com.example.app.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Configuration class for JWT-related beans.
 *
 * What this class does:
 * - Centralizes JWT configuration in one place
 * - Makes JWT settings available as properties (optional, when using @ConfigurationProperties)
 * - Can provide additional JWT-related beans
 *
 * Why it exists:
 * - Separation of concerns: Security config focuses on filter chains; JwtConfig focuses on JWT beans
 * - Enterprise projects often have dedicated config classes per domain
 * - Makes it easy to swap JWT implementation or add multiple JWT providers
 *
 * How it interacts:
 * - JwtProvider is the actual bean that generates/validates tokens (defined in auth/security)
 * - SecurityConfig wires JwtAuthenticationFilter which uses JwtProvider
 * - AuthService uses JwtProvider to generate access tokens after login/register
 */
@Configuration
public class JwtConfig {
    // JwtProvider is @Component in auth.security - no additional bean definition needed here.
    // This class serves as a placeholder for future JWT-specific configuration,
    // e.g. @EnableConfigurationProperties(JwtProperties.class) when using a properties class.
}
