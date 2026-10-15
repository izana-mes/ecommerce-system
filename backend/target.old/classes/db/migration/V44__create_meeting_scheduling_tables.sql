CREATE TABLE IF NOT EXISTS meetings (
    meeting_id UUID PRIMARY KEY,
    series_id UUID,
    title VARCHAR(220) NOT NULL,
    description TEXT,
    start_at TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    end_at TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    timezone VARCHAR(80) NOT NULL DEFAULT 'UTC',
    priority VARCHAR(20) NOT NULL DEFAULT 'MEDIUM' CHECK (priority IN ('LOW', 'MEDIUM', 'HIGH', 'URGENT')),
    visibility VARCHAR(20) NOT NULL DEFAULT 'PUBLIC' CHECK (visibility IN ('PUBLIC', 'PRIVATE')),
    status VARCHAR(20) NOT NULL DEFAULT 'SCHEDULED' CHECK (status IN ('SCHEDULED', 'CANCELLED', 'COMPLETED')),
    meeting_room VARCHAR(160),
    online_link TEXT,
    related_type VARCHAR(40),
    related_id VARCHAR(120),
    repeat_rule VARCHAR(40),
    chat_conversation_id VARCHAR(64),
    comment_thread_id VARCHAR(64),
    notes TEXT,
    created_by VARCHAR(255) NOT NULL,
    updated_by VARCHAR(255),
    reminder_sent_at TIMESTAMP WITHOUT TIME ZONE,
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    cancelled_at TIMESTAMP WITHOUT TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_meetings_window ON meetings (start_at, end_at);
CREATE INDEX IF NOT EXISTS idx_meetings_series ON meetings (series_id);
CREATE INDEX IF NOT EXISTS idx_meetings_status ON meetings (status);
CREATE INDEX IF NOT EXISTS idx_meetings_related ON meetings (related_type, related_id);

CREATE TABLE IF NOT EXISTS meeting_participants (
    meeting_id UUID NOT NULL REFERENCES meetings (meeting_id) ON DELETE CASCADE,
    participant_email VARCHAR(255) NOT NULL,
    participant_user_id UUID,
    display_name VARCHAR(220),
    role VARCHAR(30) NOT NULL DEFAULT 'ATTENDEE',
    attendance_status VARCHAR(20) NOT NULL DEFAULT 'PENDING'
        CHECK (attendance_status IN ('ACCEPTED', 'DECLINED', 'MAYBE', 'PENDING')),
    online_status VARCHAR(20) NOT NULL DEFAULT 'OFFLINE',
    joined_at TIMESTAMP WITHOUT TIME ZONE,
    left_at TIMESTAMP WITHOUT TIME ZONE,
    is_late BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (meeting_id, participant_email)
);

CREATE INDEX IF NOT EXISTS idx_meeting_participants_email ON meeting_participants (participant_email, attendance_status);
CREATE INDEX IF NOT EXISTS idx_meeting_participants_user ON meeting_participants (participant_user_id);

CREATE TABLE IF NOT EXISTS meeting_attachments (
    attachment_id UUID PRIMARY KEY,
    meeting_id UUID NOT NULL REFERENCES meetings (meeting_id) ON DELETE CASCADE,
    file_name VARCHAR(255) NOT NULL,
    file_url TEXT NOT NULL,
    content_type VARCHAR(120),
    uploaded_by VARCHAR(255),
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_meeting_attachments_meeting ON meeting_attachments (meeting_id);

CREATE TABLE IF NOT EXISTS meeting_action_items (
    action_item_id UUID PRIMARY KEY,
    meeting_id UUID NOT NULL REFERENCES meetings (meeting_id) ON DELETE CASCADE,
    body TEXT NOT NULL,
    assigned_to VARCHAR(255),
    due_at TIMESTAMP WITHOUT TIME ZONE,
    status VARCHAR(20) NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'DONE', 'CANCELLED')),
    created_by VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_meeting_action_items_meeting ON meeting_action_items (meeting_id, status);
CREATE INDEX IF NOT EXISTS idx_meeting_action_items_assignee ON meeting_action_items (assigned_to, status);

CREATE TABLE IF NOT EXISTS meeting_activity_events (
    id BIGSERIAL PRIMARY KEY,
    meeting_id UUID NOT NULL REFERENCES meetings (meeting_id) ON DELETE CASCADE,
    event_type VARCHAR(60) NOT NULL,
    actor VARCHAR(255) NOT NULL,
    details JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_meeting_activity_events_meeting ON meeting_activity_events (meeting_id, created_at DESC);
