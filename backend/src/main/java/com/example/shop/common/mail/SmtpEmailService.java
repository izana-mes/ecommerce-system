package com.example.shop.common.mail;

import jakarta.mail.MessagingException;
import jakarta.mail.internet.MimeMessage;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Service;

/**
 * SMTP implementation of the EmailService.
 * Sends synchronously so callers (e.g. password reset) get a real error if SMTP fails
 * instead of returning success while mail fails in the background.
 */
@Service
@RequiredArgsConstructor
@Slf4j
@ConditionalOnProperty(name = "application.mail.provider", havingValue = "smtp", matchIfMissing = true)
public class SmtpEmailService implements EmailService {

    private final JavaMailSender mailSender;
    private final EmailTemplateService templateService;

    @Value("${spring.mail.username}")
    private String senderEmail;

    @Override
    public void sendEmail(String to, String subject, String content) {
        log.info("Sending email to: {}", to);
        try {
            MimeMessage message = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");

            helper.setFrom(senderEmail);
            helper.setTo(to);
            helper.setSubject(subject);
            helper.setText(content, true); // true = isHtml

            mailSender.send(message);
            log.info("Email sent successfully to: {}", to);
        } catch (MessagingException e) {
            log.error("Failed to send email to {}", to, e);
            throw new RuntimeException("Failed to send email", e);
        }
    }

    @Override
    public void sendVerificationEmail(String to, String name, String token) {
        String subject = "Verify your email address";
        String content = templateService.generateVerificationEmail(name, token);
        sendEmail(to, subject, content);
    }

    @Override
    public void sendPasswordResetEmail(String to, String name, String token) {
        String subject = "Reset your password";
        String content = templateService.generatePasswordResetEmail(name, token);
        sendEmail(to, subject, content);
    }

    @Override
    public void sendOtpEmail(String to, String name, String otp) {
        String subject = "Your verification code";
        String content = templateService.generateOtpEmail(name, otp);
        sendEmail(to, subject, content);
    }
}
