package com.example.shop.common.mail;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

import java.util.List;
import java.util.Map;

/**
 * Resend-backed implementation of the EmailService.
 */
@Service
@RequiredArgsConstructor
@Slf4j
@ConditionalOnProperty(name = "application.mail.provider", havingValue = "resend")
public class ResendEmailService implements EmailService {

    private final EmailTemplateService templateService;

    private final RestClient restClient = RestClient.builder()
            .baseUrl("https://api.resend.com")
            .defaultHeader(HttpHeaders.CONTENT_TYPE, MediaType.APPLICATION_JSON_VALUE)
            .build();

    @Value("${application.mail.resend.api-key:}")
    private String resendApiKey;

    @Value("${application.mail.resend.from-email:}")
    private String fromEmail;

    @Value("${application.mail.resend.from-name:Shop}")
    private String fromName;

    @Override
    public void sendEmail(String to, String subject, String content) {
        if (resendApiKey == null || resendApiKey.isBlank()) {
            throw new IllegalStateException("RESEND_API_KEY is not configured");
        }
        if (fromEmail == null || fromEmail.isBlank()) {
            throw new IllegalStateException("RESEND_FROM_EMAIL is not configured");
        }

        String from = (fromName == null || fromName.isBlank())
                ? fromEmail.trim()
                : fromName.trim() + " <" + fromEmail.trim() + ">";

        Map<String, Object> payload = Map.of(
                "from", from,
                "to", List.of(to),
                "subject", subject == null ? "" : subject,
                "html", content == null ? "" : content
        );

        try {
            @SuppressWarnings("unchecked")
            Map<String, Object> response = restClient.post()
                    .uri("/emails")
                    .header(HttpHeaders.AUTHORIZATION, "Bearer " + resendApiKey.trim())
                    .body(payload)
                    .retrieve()
                    .body(Map.class);
            log.info("Email sent successfully via Resend to {} with id {}", to, response == null ? null : response.get("id"));
        } catch (RestClientException e) {
            log.error("Failed to send email via Resend to {}", to, e);
            throw new RuntimeException("Failed to send email via Resend", e);
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
