package com.example.app.common.mail;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

/**
 * Service to generate HTML email templates.
 * In a larger app, this might use Thymeleaf or FreeMarker.
 * For now, we use simple string construction for educational clarity.
 */
@Service
public class EmailTemplateService {

    @Value("${application.server.url:http://localhost:8080}")
    private String serverUrl;

    public String generateVerificationEmail(String name, String token) {
        String verifyUrl = serverUrl + "/api/v1/auth/verify-email?token=" + token;

        return String.format(
                """
                        <html>
                            <body>
                                <h2>Welcome, %s!</h2>
                                <p>Thank you for registering. Please click the link below to verify your email address:</p>
                                <p>
                                    <a href="%s" style="background-color: #4CAF50; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Verify Email</a>
                                </p>
                                <p>Or copy this link: %s</p>
                                <p>This link will expire in 24 hours.</p>
                            </body>
                        </html>
                        """,
                name, verifyUrl, verifyUrl);
    }

    public String generatePasswordResetEmail(String name, String token) {
        // In a real frontend app, this would link to a frontend page
        // For API-only, we provide the token

        return String.format("""
                <html>
                    <body>
                        <h2>Hello %s,</h2>
                        <p>We received a request to reset your password.</p>
                        <p>Use the following token to reset your password via the API:</p>
                        <h3 style="font-family: monospace; background-color: #f0f0f0; padding: 10px;">%s</h3>
                        <p>This token is valid for 1 hour.</p>
                        <p>If you did not request this, please ignore this email.</p>
                    </body>
                </html>
                """, name, token);
    }
}
