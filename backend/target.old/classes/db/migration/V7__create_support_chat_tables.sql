CREATE TABLE IF NOT EXISTS support_chat_conversations (
    conversation_id VARCHAR(64) PRIMARY KEY,
    customer_user_id VARCHAR(64),
    customer_email VARCHAR(255),
    guest_id VARCHAR(128),
    status VARCHAR(16) NOT NULL DEFAULT 'open',
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_message_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS support_chat_messages (
    message_id VARCHAR(64) PRIMARY KEY,
    conversation_id VARCHAR(64) NOT NULL,
    sender_role VARCHAR(16) NOT NULL,
    sender_email VARCHAR(255),
    body TEXT NOT NULL,
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_support_chat_messages_conn_id ON support_chat_messages(conversation_id);
