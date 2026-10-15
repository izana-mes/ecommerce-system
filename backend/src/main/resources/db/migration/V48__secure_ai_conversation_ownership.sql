ALTER TABLE chatbot_conversations ADD COLUMN IF NOT EXISTS owner_user_id VARCHAR(36);
ALTER TABLE chatbot_conversations ADD COLUMN IF NOT EXISTS audience VARCHAR(16) NOT NULL DEFAULT 'CUSTOMER';
CREATE INDEX IF NOT EXISTS idx_chatbot_conversations_owner_audience_updated
    ON chatbot_conversations(owner_user_id, audience, last_message_at DESC);
