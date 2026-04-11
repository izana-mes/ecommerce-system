package com.example.app.common.mail;

import jakarta.mail.MessagingException;
import jakarta.mail.internet.MimeMessage;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

/**
 * SMTP implementation of the EmailService.
 * Uses JavaMailSender to send emails.
 * Methods are @Async to avoid blocking the main thread.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class SmtpEmailService implements EmailService {

    private final JavaMailSender mailSender;
    private final EmailTemplateService templateService;

    @Value("${spring.mail.username}")
    private String senderEmail;

    @Override
    @Async
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
    @Async
    public void sendVerificationEmail(String to, String name, String token) {
        String subject = "Verify your email address";
        String content = templateService.generateVerificationEmail(name, token);
        sendEmail(to, subject, content);
    }

    @Override
    @Async
    public void sendPasswordResetEmail(String to, String name, String token) {
        String subject = "Reset your password";
        String content = templateService.generatePasswordResetEmail(name, token);
        sendEmail(to, subject, content);
    }
}
