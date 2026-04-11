package com.example.shop.modules.messaging.email;

import com.example.shop.common.mail.EmailService;
import com.example.shop.config.ConditionalOnRabbitEnabled;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
@ConditionalOnRabbitEnabled
@Slf4j
public class EmailMessageConsumer {

    private final EmailService emailService;

    @RabbitListener(queues = "${application.messaging.queue.email-general}")
    public void consume(EmailMessage message) {
        if (message == null) {
            log.warn("Received null email message");
            return;
        }

        log.info("Consuming {} email for {}", message.getEmailType(), message.getTo());

        switch (message.getEmailType()) {
            case OTP -> emailService.sendOtpEmail(
                    message.getTo(),
                    message.getRecipientName(),
                    message.getOtp()
            );
            case VERIFICATION -> emailService.sendVerificationEmail(
                    message.getTo(),
                    message.getRecipientName(),
                    message.getToken()
            );
            case PASSWORD_RESET -> emailService.sendPasswordResetEmail(
                    message.getTo(),
                    message.getRecipientName(),
                    message.getToken()
            );
            default -> emailService.sendEmail(
                    message.getTo(),
                    message.getSubject(),
                    message.getContent()
            );
        }
    }
}
