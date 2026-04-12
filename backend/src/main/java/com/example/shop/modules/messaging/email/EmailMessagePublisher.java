package com.example.shop.modules.messaging.email;

import com.example.shop.common.mail.EmailService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
@Slf4j
public class EmailMessagePublisher {

    private final ObjectProvider<RabbitTemplate> rabbitTemplate;
    private final EmailService emailService;

    @Value("${application.messaging.exchange}")
    private String exchange;

    @Value("${application.messaging.routing-key.email-general}")
    private String routingKey;

    public void publish(EmailMessage message) {
        RabbitTemplate rt = rabbitTemplate.getIfAvailable();
        if (rt != null) {
            try {
                log.info("Publishing {} email to {}", message.getEmailType(), message.getTo());
                rt.convertAndSend(exchange, routingKey, message);
                return;
            } catch (Exception e) {
                log.warn("RabbitMQ publish failed, sending mail via SMTP instead: {}", e.getMessage());
            }
        } else {
            log.debug("RabbitMQ unavailable; sending mail via SMTP");
        }
        dispatchDirect(message);
    }

    private void dispatchDirect(EmailMessage message) {
        if (message == null || message.getTo() == null || message.getTo().isBlank()) {
            log.warn("Skip direct email: missing recipient");
            return;
        }
        EmailMessage.EmailType type = message.getEmailType();
        if (type == null) {
            emailService.sendEmail(
                    message.getTo(),
                    message.getSubject() != null ? message.getSubject() : "",
                    message.getContent() != null ? message.getContent() : "");
            return;
        }
        switch (type) {
            case OTP -> emailService.sendOtpEmail(
                    message.getTo(),
                    safeName(message.getRecipientName()),
                    message.getOtp());
            case VERIFICATION -> emailService.sendVerificationEmail(
                    message.getTo(),
                    safeName(message.getRecipientName()),
                    message.getToken());
            case PASSWORD_RESET -> emailService.sendPasswordResetEmail(
                    message.getTo(),
                    safeName(message.getRecipientName()),
                    message.getToken());
            default -> emailService.sendEmail(
                    message.getTo(),
                    message.getSubject() != null ? message.getSubject() : "",
                    message.getContent() != null ? message.getContent() : "");
        }
    }

    private static String safeName(String name) {
        return name != null && !name.isBlank() ? name : "there";
    }
}
