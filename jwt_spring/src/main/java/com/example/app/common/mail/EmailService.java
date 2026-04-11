package com.example.app.common.mail;

/**
 * Interface for email sending operations.
 * Decouples the business logic from the specific email implementation (SMTP,
 * SendGrid, etc).
 */
public interface EmailService {

    /**
     * Send a general email.
     * 
     * @param to      Recipient email address
     * @param subject Email subject
     * @param content Email body content (HTML supported)
     */
    void sendEmail(String to, String subject, String content);

    /**
     * Send an email verification link.
     * 
     * @param to    Recipient email address
     * @param name  Recipient name
     * @param token Verification token
     */
    void sendVerificationEmail(String to, String name, String token);

    /**
     * Send a password reset link.
     * 
     * @param to    Recipient email address
     * @param name  Recipient name
     * @param token Password reset token
     */
    void sendPasswordResetEmail(String to, String name, String token);
}
