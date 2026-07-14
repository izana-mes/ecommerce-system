package com.example.shop.modules.meeting.realtime;

import lombok.RequiredArgsConstructor;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

import java.util.Map;

@Component
@RequiredArgsConstructor
public class MeetingRealtimePublisher {

    private final SimpMessagingTemplate messagingTemplate;

    public void publishCalendarChanged(String recipient, Map<String, Object> payload) {
        if (!StringUtils.hasText(recipient) || payload == null || payload.isEmpty()) {
            return;
        }
        messagingTemplate.convertAndSend("/topic/meetings/calendar/" + recipient.trim().toLowerCase(), payload);
    }

    public void publishTeamChanged(Map<String, Object> payload) {
        if (payload == null || payload.isEmpty()) {
            return;
        }
        messagingTemplate.convertAndSend("/topic/meetings/team", payload);
    }

    public void publishMeetingChanged(String meetingId, Map<String, Object> payload) {
        if (!StringUtils.hasText(meetingId) || payload == null || payload.isEmpty()) {
            return;
        }
        messagingTemplate.convertAndSend("/topic/meetings/" + meetingId, payload);
    }
}
