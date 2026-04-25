CREATE TABLE IF NOT EXISTS chatbot_conversations (
    conversation_id VARCHAR(64) PRIMARY KEY,
    user_email VARCHAR(255),
    guest_id VARCHAR(128),
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_message_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS chatbot_messages (
    message_id VARCHAR(64) PRIMARY KEY,
    conversation_id VARCHAR(64) NOT NULL,
    message_role VARCHAR(16) NOT NULL,
    body TEXT NOT NULL,
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_chatbot_conversations_user_email
    ON chatbot_conversations(user_email);

CREATE INDEX IF NOT EXISTS idx_chatbot_conversations_guest_id
    ON chatbot_conversations(guest_id);

CREATE INDEX IF NOT EXISTS idx_chatbot_messages_conversation_id
    ON chatbot_messages(conversation_id);
