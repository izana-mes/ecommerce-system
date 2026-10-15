-- Migration V46: Additional performance indexes for modern messaging
CREATE INDEX IF NOT EXISTS idx_social_conversation_members_conv
    ON social_conversation_members (conversation_id) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_social_messages_conv_created_asc
    ON social_messages (conversation_id, created_at ASC);

CREATE INDEX IF NOT EXISTS idx_social_reactions_target_lookup
    ON social_reactions (target_type, target_id);

CREATE INDEX IF NOT EXISTS idx_social_typing_active
    ON social_typing_status (conversation_id, expires_at);
