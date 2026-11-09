package com.example.shop.modules.notification.service;

import com.example.shop.common.exception.BusinessException;
import com.example.shop.modules.notification.entity.CustomerNotification;
import com.example.shop.modules.notification.repository.CustomerNotificationRepository;
import com.example.shop.modules.user.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.messaging.simp.SimpMessagingTemplate;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class CustomerNotificationServiceTest {

    private CustomerNotificationRepository repository;
    private UserRepository userRepository;
    private SimpMessagingTemplate messaging;
    private JdbcTemplate jdbcTemplate;
    private CustomerNotificationService service;

    private final UUID userA = UUID.randomUUID();
    private final UUID userB = UUID.randomUUID();

    @BeforeEach
    void setUp() {
        repository = mock(CustomerNotificationRepository.class);
        userRepository = mock(UserRepository.class);
        messaging = mock(SimpMessagingTemplate.class);
        jdbcTemplate = mock(JdbcTemplate.class);

        service = new CustomerNotificationService(repository, userRepository, messaging, jdbcTemplate);
    }

    @Test
    void createForUser_insertsAndSendsRealtimeMessage() {
        when(jdbcTemplate.update(anyString(), eq(userA), eq("dedupe-1"), eq("order"), eq("Title"), eq("Msg"), eq("/orders"), isNull(), any(LocalDateTime.class)))
                .thenReturn(1);

        service.createForUser(userA, "dedupe-1", "order", "Title", "Msg", "/orders");

        verify(messaging).convertAndSend(eq("/topic/customer-notifications/" + userA), any(Map.class));
    }

    @Test
    void createForUser_duplicateIgnored() {
        when(jdbcTemplate.update(anyString(), eq(userA), eq("dedupe-dup"), eq("order"), any(), any(), any(), any(), any()))
                .thenReturn(0);

        service.createForUser(userA, "dedupe-dup", "order", "Title", "Msg", "/orders");

        verify(messaging, never()).convertAndSend(anyString(), any(Map.class));
    }

    @Test
    void list_withoutPagination_returnsTop100AndUnreadCount() {
        CustomerNotification n = CustomerNotification.builder()
                .id(1L)
                .userId(userA)
                .title("Test")
                .category("order")
                .createdAt(LocalDateTime.now())
                .build();
        when(repository.findTop100ByUserIdOrderByCreatedAtDesc(userA)).thenReturn(List.of(n));
        when(repository.countByUserIdAndReadAtIsNull(userA)).thenReturn(1L);
        when(repository.countByUserId(userA)).thenReturn(1L);

        Map<String, Object> result = service.list(userA);

        assertThat(result.get("unreadCount")).isEqualTo(1L);
        assertThat(result.get("items")).isEqualTo(List.of(n));
    }

    @Test
    void list_withPagination_filtersCategoryAndUnread() {
        CustomerNotification n = CustomerNotification.builder()
                .id(2L)
                .userId(userA)
                .category("product")
                .title("Moderation update")
                .createdAt(LocalDateTime.now())
                .build();
        Page<CustomerNotification> page = new PageImpl<>(List.of(n), PageRequest.of(0, 10), 1);
        when(repository.findByUserIdAndCategoryIgnoreCaseAndReadAtIsNullOrderByCreatedAtDesc(eq(userA), eq("product"), any()))
                .thenReturn(page);
        when(repository.countByUserIdAndReadAtIsNull(userA)).thenReturn(1L);

        Map<String, Object> result = service.list(userA, 0, 10, "product", "unread");

        assertThat(result.get("totalElements")).isEqualTo(1L);
        assertThat(result.get("items")).isEqualTo(List.of(n));
    }

    @Test
    void markRead_updatesReadAtWhenNull() {
        CustomerNotification n = CustomerNotification.builder()
                .id(10L)
                .userId(userA)
                .readAt(null)
                .build();
        when(repository.findByIdAndUserId(10L, userA)).thenReturn(Optional.of(n));

        service.markRead(10L, userA);

        assertThat(n.getReadAt()).isNotNull();
    }

    @Test
    void markRead_userIsolation_throwsWhenOtherUser() {
        when(repository.findByIdAndUserId(10L, userB)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.markRead(10L, userB))
                .isInstanceOf(BusinessException.class);
    }

    @Test
    void markAllRead_callsRepositoryWithNow() {
        service.markAllRead(userA);
        verify(repository).markAllRead(eq(userA), any(LocalDateTime.class));
    }

    @Test
    void getById_userIsolation() {
        CustomerNotification n = CustomerNotification.builder().id(5L).userId(userA).build();
        when(repository.findByIdAndUserId(5L, userA)).thenReturn(Optional.of(n));
        when(repository.findByIdAndUserId(5L, userB)).thenReturn(Optional.empty());

        assertThat(service.getById(5L, userA)).isEqualTo(n);
        assertThatThrownBy(() -> service.getById(5L, userB)).isInstanceOf(BusinessException.class);
    }
}
