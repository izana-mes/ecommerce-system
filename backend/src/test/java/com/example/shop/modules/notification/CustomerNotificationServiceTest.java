package com.example.shop.modules.notification;

import com.example.shop.modules.notification.repository.CustomerNotificationRepository;
import com.example.shop.modules.notification.service.CustomerNotificationService;
import com.example.shop.modules.user.repository.UserRepository;
import com.example.shop.modules.user.entity.User;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.messaging.simp.SimpMessagingTemplate;

import java.util.UUID;
import java.util.Optional;

import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class CustomerNotificationServiceTest {
    @Test
    void messageNotificationIsDeduplicatedAndPublishedOnlyToRecipient() {
        CustomerNotificationRepository repository = mock(CustomerNotificationRepository.class);
        UserRepository users = mock(UserRepository.class);
        SimpMessagingTemplate messaging = mock(SimpMessagingTemplate.class);
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        CustomerNotificationService service = new CustomerNotificationService(repository, users, messaging, jdbc);
        UUID recipient = UUID.randomUUID();
        when(jdbc.update(anyString(), any(), any(), any(), any(), any(), any())).thenReturn(1);

        service.createForUser(recipient, "chat-message:1:" + recipient, "New message from Sam", "Hi", "/messages?conversationId=conv-1");

        verify(jdbc).update(contains("ON CONFLICT (dedupe_key) DO NOTHING"), eq(recipient),
                eq("chat-message:1:" + recipient), eq("New message from Sam"), eq("Hi"),
                eq("/messages?conversationId=conv-1"), any());
        verify(messaging).convertAndSend(eq("/topic/customer-notifications/" + recipient), anyMap());
    }

    @Test
    void duplicateMessageNotificationDoesNotPublishAgain() {
        SimpMessagingTemplate messaging = mock(SimpMessagingTemplate.class);
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        CustomerNotificationService service = new CustomerNotificationService(mock(CustomerNotificationRepository.class),
                mock(UserRepository.class), messaging, jdbc);
        service.createForUser(UUID.randomUUID(), "duplicate", "Title", "Preview", "/messages");
        verifyNoInteractions(messaging);
    }

    @Test
    void existingCouponNotificationPathStillPublishesForResolvedRecipient() {
        UUID recipient = UUID.randomUUID();
        User user = User.builder().id(recipient).email("customer@example.com").build();
        UserRepository users = mock(UserRepository.class);
        SimpMessagingTemplate messaging = mock(SimpMessagingTemplate.class);
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        when(users.findByEmailIgnoreCase("customer@example.com")).thenReturn(Optional.of(user));
        when(jdbc.update(anyString(), any(), any(), any(), any(), any(), any(), any())).thenReturn(1);
        when(jdbc.update(anyString(), any(), any(), any(), any(), any(), any())).thenReturn(1);
        CustomerNotificationService service = new CustomerNotificationService(mock(CustomerNotificationRepository.class), users, messaging, jdbc);

        service.createForEmail("customer@example.com", "coupon:assignment:5", "coupon", "Coupon available", "Save 10%", "/coupons/redeem");

        verify(jdbc).update(contains("INSERT INTO customer_notifications"), eq(recipient), eq("coupon:assignment:5"),
                eq("coupon"), eq("Coupon available"), eq("Save 10%"), eq("/coupons/redeem"), any());
        verify(messaging).convertAndSend(eq("/topic/customer-notifications/" + recipient), anyMap());
    }
}
