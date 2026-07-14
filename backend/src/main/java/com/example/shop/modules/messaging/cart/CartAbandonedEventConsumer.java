package com.example.shop.modules.messaging.cart;

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
public class CartAbandonedEventConsumer {

    private final EmailService emailService;

    @RabbitListener(queues = "${application.messaging.queue.cart-abandoned}")
    public void consume(CartAbandonedEvent event) {
        if (event == null || event.getEmail() == null || event.getEmail().isBlank()) {
            log.warn("Received invalid cart abandoned event");
            return;
        }

        String name = (event.getFirstName() == null || event.getFirstName().isBlank()) ? "there" : event.getFirstName();
        String subject = "You left items in your cart";
        String content = String.format(
                "Hi %s,\n\nYou still have %d item(s) (%d quantity total) waiting in your cart.\nReturn to checkout before items go out of stock.\n\n- Shop Team",
                name,
                safe(event.getItemCount()),
                safe(event.getTotalQuantity())
        );

        emailService.sendEmail(event.getEmail(), subject, content);
        log.info("Sent abandoned cart reminder to {}", event.getEmail());
    }

    private static int safe(Integer n) {
        return n == null ? 0 : Math.max(0, n);
    }
}
