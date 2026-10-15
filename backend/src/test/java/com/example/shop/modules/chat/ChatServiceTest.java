package com.example.shop.modules.chat;

import com.example.shop.common.exception.BusinessException;
import com.example.shop.modules.chat.dto.EditMessageRequest;
import com.example.shop.modules.chat.dto.MessageDto;
import com.example.shop.modules.chat.dto.SendMessageRequest;
import com.example.shop.modules.chat.entity.SocialConversation;
import com.example.shop.modules.chat.entity.SocialConversationMember;
import com.example.shop.modules.chat.entity.SocialConversationMemberId;
import com.example.shop.modules.chat.entity.SocialMessage;
import com.example.shop.modules.chat.entity.SocialReaction;
import com.example.shop.modules.chat.realtime.ChatRealtimePublisher;
import com.example.shop.modules.chat.repository.SocialConversationMemberRepository;
import com.example.shop.modules.chat.repository.SocialConversationRepository;
import com.example.shop.modules.chat.repository.SocialMessageRepository;
import com.example.shop.modules.chat.repository.SocialReactionCountRepository;
import com.example.shop.modules.chat.repository.SocialReactionRepository;
import com.example.shop.modules.chat.service.ChatServiceImpl;
import com.example.shop.modules.user.entity.User;
import com.example.shop.modules.user.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Pageable;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ChatServiceTest {

    @Mock private SocialConversationRepository conversationRepository;
    @Mock private SocialConversationMemberRepository memberRepository;
    @Mock private SocialMessageRepository messageRepository;
    @Mock private SocialReactionRepository reactionRepository;
    @Mock private SocialReactionCountRepository reactionCountRepository;
    @Mock private UserRepository userRepository;
    @Mock private ChatRealtimePublisher realtimePublisher;

    @InjectMocks private ChatServiceImpl chatService;

    private User userAlice;
    private User userBob;
    private final String conversationId = "conv_100";
    private final UUID aliceId = UUID.fromString("11111111-1111-1111-1111-111111111111");
    private final UUID bobId = UUID.fromString("22222222-2222-2222-2222-222222222222");

    @BeforeEach
    void setUp() {
        userAlice = User.builder().id(aliceId).email("alice@example.com").firstName("Alice").build();
        userBob = User.builder().id(bobId).email("bob@example.com").firstName("Bob").build();
    }

    @Test
    void sendMessage_successWhenMember() {
        when(memberRepository.existsByIdConversationIdAndIdUserIdAndDeletedAtIsNull(conversationId, aliceId.toString()))
                .thenReturn(true);
        when(conversationRepository.findById(conversationId)).thenReturn(Optional.of(
                SocialConversation.builder().conversationId(conversationId).type("direct").build()));
        when(memberRepository.findByIdConversationIdAndDeletedAtIsNull(conversationId)).thenReturn(List.of(
                SocialConversationMember.builder().id(new SocialConversationMemberId(conversationId, bobId.toString())).build()
        ));

        SendMessageRequest request = SendMessageRequest.builder().body("Hello Bob!").build();
        MessageDto result = chatService.sendMessage(conversationId, userAlice, request);

        assertNotNull(result);
        assertEquals("Hello Bob!", result.getBody());
        assertEquals(aliceId.toString(), result.getSenderUserId());
        verify(messageRepository).save(any(SocialMessage.class));
        verify(realtimePublisher).publishNewMessage(eq(conversationId), any(MessageDto.class));
    }

    @Test
    void sendMessage_failsWhenNotMember() {
        when(memberRepository.existsByIdConversationIdAndIdUserIdAndDeletedAtIsNull(conversationId, aliceId.toString()))
                .thenReturn(false);

        SendMessageRequest request = SendMessageRequest.builder().body("Hello").build();
        assertThrows(BusinessException.class, () -> chatService.sendMessage(conversationId, userAlice, request));
        verify(messageRepository, never()).save(any());
    }

    @Test
    void editMessage_successOnlyForOwnMessage() {
        String msgId = "msg_1";
        SocialMessage msg = SocialMessage.builder()
                .messageId(msgId)
                .conversationId(conversationId)
                .senderUserId(aliceId.toString())
                .body("Old text")
                .createdAt(LocalDateTime.now())
                .build();

        when(messageRepository.findById(msgId)).thenReturn(Optional.of(msg));
        when(memberRepository.existsByIdConversationIdAndIdUserIdAndDeletedAtIsNull(conversationId, aliceId.toString()))
                .thenReturn(true);

        EditMessageRequest request = EditMessageRequest.builder().body("Updated text").build();
        MessageDto result = chatService.editMessage(msgId, userAlice, request);

        assertEquals("Updated text", result.getBody());
        assertTrue(result.getEdited());
        verify(messageRepository).save(msg);
        verify(realtimePublisher).publishEditMessage(eq(conversationId), any(MessageDto.class));
    }

    @Test
    void editMessage_forbiddenForAnotherUsersMessage() {
        String msgId = "msg_1";
        SocialMessage msg = SocialMessage.builder()
                .messageId(msgId)
                .conversationId(conversationId)
                .senderUserId(aliceId.toString())
                .body("Old text")
                .build();

        when(messageRepository.findById(msgId)).thenReturn(Optional.of(msg));
        when(memberRepository.existsByIdConversationIdAndIdUserIdAndDeletedAtIsNull(conversationId, bobId.toString()))
                .thenReturn(true);

        EditMessageRequest request = EditMessageRequest.builder().body("Hacked text").build();
        assertThrows(BusinessException.class, () -> chatService.editMessage(msgId, userBob, request));
        assertEquals("Old text", msg.getBody());
    }

    @Test
    void deleteMessage_successOnlyForOwnMessage() {
        String msgId = "msg_2";
        SocialMessage msg = SocialMessage.builder()
                .messageId(msgId)
                .conversationId(conversationId)
                .senderUserId(aliceId.toString())
                .body("I want to delete this")
                .build();

        when(messageRepository.findById(msgId)).thenReturn(Optional.of(msg));
        when(memberRepository.existsByIdConversationIdAndIdUserIdAndDeletedAtIsNull(conversationId, aliceId.toString()))
                .thenReturn(true);

        chatService.deleteMessage(msgId, userAlice);

        assertNotNull(msg.getDeletedForEveryoneAt());
        assertNull(msg.getBody());
        verify(realtimePublisher).publishDeleteMessage(conversationId, msgId);
    }

    @Test
    void deleteMessage_forbiddenForAnotherUsersMessage() {
        String msgId = "msg_2";
        SocialMessage msg = SocialMessage.builder()
                .messageId(msgId)
                .conversationId(conversationId)
                .senderUserId(aliceId.toString())
                .body("Original")
                .build();

        when(messageRepository.findById(msgId)).thenReturn(Optional.of(msg));
        when(memberRepository.existsByIdConversationIdAndIdUserIdAndDeletedAtIsNull(conversationId, bobId.toString()))
                .thenReturn(true);

        assertThrows(BusinessException.class, () -> chatService.deleteMessage(msgId, userBob));
        assertNull(msg.getDeletedForEveryoneAt());
    }

    @Test
    void toggleReaction_addsNewReactionAndPreventsDuplicate() {
        String msgId = "msg_3";
        SocialMessage msg = SocialMessage.builder()
                .messageId(msgId)
                .conversationId(conversationId)
                .senderUserId(bobId.toString())
                .build();

        when(messageRepository.findById(msgId)).thenReturn(Optional.of(msg));
        when(memberRepository.existsByIdConversationIdAndIdUserIdAndDeletedAtIsNull(conversationId, aliceId.toString()))
                .thenReturn(true);
        when(reactionRepository.findByTargetTypeAndTargetIdAndUserId("message", msgId, aliceId.toString()))
                .thenReturn(Optional.empty());

        // First click: add "love"
        chatService.toggleReaction(msgId, userAlice, "love");
        verify(reactionRepository).save(any(SocialReaction.class));

        // If clicked again with same reaction, it should remove it (toggle off)
        SocialReaction existing = SocialReaction.builder()
                .reactionId("rxn_1")
                .targetType("message")
                .targetId(msgId)
                .userId(aliceId.toString())
                .reaction("love")
                .build();
        when(reactionRepository.findByTargetTypeAndTargetIdAndUserId("message", msgId, aliceId.toString()))
                .thenReturn(Optional.of(existing));

        chatService.toggleReaction(msgId, userAlice, "love");
        verify(reactionRepository).delete(existing);
    }

    @Test
    void getMessages_returnsPaginatedList() {
        when(memberRepository.existsByIdConversationIdAndIdUserIdAndDeletedAtIsNull(conversationId, aliceId.toString()))
                .thenReturn(true);

        SocialMessage m1 = SocialMessage.builder().messageId("m1").conversationId(conversationId).body("One").createdAt(LocalDateTime.now().minusMinutes(5)).build();
        SocialMessage m2 = SocialMessage.builder().messageId("m2").conversationId(conversationId).body("Two").createdAt(LocalDateTime.now().minusMinutes(2)).build();

        when(messageRepository.findRecentByConversationId(eq(conversationId), any(Pageable.class)))
                .thenReturn(List.of(m2, m1));

        List<MessageDto> result = chatService.getMessages(conversationId, userAlice, null, 20);
        assertEquals(2, result.size());
        // Ordered chronologically
        assertEquals("m1", result.get(0).getMessageId());
        assertEquals("m2", result.get(1).getMessageId());
    }

    @Test
    void getMessages_forbiddenWhenNotMember() {
        when(memberRepository.existsByIdConversationIdAndIdUserIdAndDeletedAtIsNull(conversationId, bobId.toString()))
                .thenReturn(false);

        assertThrows(BusinessException.class, () -> chatService.getMessages(conversationId, userBob, null, 20));
        verify(messageRepository, never()).findRecentByConversationId(any(), any());
    }

    @Test
    void hasConversationAccess_trueForMember_falseForStranger() {
        when(memberRepository.existsByIdConversationIdAndIdUserIdAndDeletedAtIsNull(conversationId, aliceId.toString()))
                .thenReturn(true);
        when(memberRepository.existsByIdConversationIdAndIdUserIdAndDeletedAtIsNull(conversationId, bobId.toString()))
                .thenReturn(false);

        assertTrue(chatService.hasConversationAccess(conversationId, userAlice));
        assertFalse(chatService.hasConversationAccess(conversationId, userBob));
    }

    @Test
    void markAsRead_skipsWriteWhenAlreadyCaughtUp() {
        when(memberRepository.existsByIdConversationIdAndIdUserIdAndDeletedAtIsNull(conversationId, aliceId.toString()))
                .thenReturn(true);
        SocialConversationMember membership = SocialConversationMember.builder()
                .id(new SocialConversationMemberId(conversationId, aliceId.toString()))
                .messageUnreadCount(0)
                .lastReadMessageId("m-last")
                .build();
        when(memberRepository.findByIdConversationIdAndIdUserIdAndDeletedAtIsNull(conversationId, aliceId.toString()))
                .thenReturn(Optional.of(membership));
        when(messageRepository.findFirstByConversationIdOrderByCreatedAtDesc(conversationId))
                .thenReturn(Optional.of(SocialMessage.builder().messageId("m-last").conversationId(conversationId).build()));

        chatService.markAsRead(conversationId, userAlice);

        verify(memberRepository, never()).save(any());
        verify(realtimePublisher, never()).publishReadUpdate(any(), any());
    }

    @Test
    void toggleReaction_forbiddenWhenNotMember() {
        String msgId = "msg_3";
        SocialMessage msg = SocialMessage.builder()
                .messageId(msgId)
                .conversationId(conversationId)
                .senderUserId(aliceId.toString())
                .build();
        when(messageRepository.findById(msgId)).thenReturn(Optional.of(msg));
        when(memberRepository.existsByIdConversationIdAndIdUserIdAndDeletedAtIsNull(conversationId, bobId.toString()))
                .thenReturn(false);

        assertThrows(BusinessException.class, () -> chatService.toggleReaction(msgId, userBob, "love"));
        verify(reactionRepository, never()).save(any());
    }
}
