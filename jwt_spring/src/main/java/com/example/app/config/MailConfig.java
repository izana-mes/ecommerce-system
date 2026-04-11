package com.example.app.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableAsync;

/**
 * Mail-related configuration.
 *
 * @EnableAsync: Required for @Async on EmailService methods (sendVerificationEmail, etc.)
 * so email sending does not block the HTTP request thread.
 */
@Configuration
@EnableAsync
public class MailConfig {
}
