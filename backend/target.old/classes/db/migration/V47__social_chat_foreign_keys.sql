-- Keep the messaging graph internally consistent without coupling the new
-- string-based social IDs to the UUID primary keys used by the legacy users table.
ALTER TABLE social_conversation_members
    ADD CONSTRAINT fk_social_members_conversation
    FOREIGN KEY (conversation_id) REFERENCES social_conversations (conversation_id)
    ON DELETE CASCADE;

ALTER TABLE social_messages
    ADD CONSTRAINT fk_social_messages_conversation
    FOREIGN KEY (conversation_id) REFERENCES social_conversations (conversation_id)
    ON DELETE CASCADE;

ALTER TABLE social_messages
    ADD CONSTRAINT fk_social_messages_reply_to
    FOREIGN KEY (reply_to_message_id) REFERENCES social_messages (message_id)
    ON DELETE SET NULL;

ALTER TABLE social_message_attachments
    ADD CONSTRAINT fk_social_attachments_message
    FOREIGN KEY (message_id) REFERENCES social_messages (message_id)
    ON DELETE CASCADE;

ALTER TABLE social_message_receipts
    ADD CONSTRAINT fk_social_receipts_message
    FOREIGN KEY (message_id) REFERENCES social_messages (message_id)
    ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_social_messages_reply_to
    ON social_messages (reply_to_message_id) WHERE reply_to_message_id IS NOT NULL;
