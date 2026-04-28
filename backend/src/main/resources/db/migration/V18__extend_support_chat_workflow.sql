ALTER TABLE support_chat_conversations
    ADD COLUMN IF NOT EXISTS assigned_to_user_id VARCHAR(64);

ALTER TABLE support_chat_conversations
    ADD COLUMN IF NOT EXISTS assigned_to_email VARCHAR(255);

ALTER TABLE support_chat_conversations
    ADD COLUMN IF NOT EXISTS internal_note TEXT;

ALTER TABLE support_chat_conversations
    ADD COLUMN IF NOT EXISTS priority VARCHAR(16) NOT NULL DEFAULT 'normal';

CREATE INDEX IF NOT EXISTS idx_support_chat_conversations_status_last_message
    ON support_chat_conversations (status, last_message_at DESC);

CREATE INDEX IF NOT EXISTS idx_support_chat_conversations_assignee
    ON support_chat_conversations (assigned_to_user_id, last_message_at DESC);
