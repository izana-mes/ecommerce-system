CREATE TABLE IF NOT EXISTS social_conversations (
    conversation_id VARCHAR(64) PRIMARY KEY,
    type VARCHAR(16) NOT NULL CHECK (type IN ('direct', 'group', 'support', 'order')),
    title VARCHAR(160),
    avatar_url TEXT,
    order_id VARCHAR(64),
    created_by_user_id VARCHAR(64),
    status VARCHAR(24) NOT NULL DEFAULT 'active',
    last_message_id VARCHAR(64),
    last_message_at TIMESTAMP WITHOUT TIME ZONE,
    pinned_message_id VARCHAR(64),
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITHOUT TIME ZONE
);

CREATE TABLE IF NOT EXISTS social_conversation_members (
    conversation_id VARCHAR(64) NOT NULL,
    user_id VARCHAR(64) NOT NULL,
    role VARCHAR(24) NOT NULL DEFAULT 'member',
    joined_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_read_message_id VARCHAR(64),
    last_read_at TIMESTAMP WITHOUT TIME ZONE,
    muted_until TIMESTAMP WITHOUT TIME ZONE,
    mention_unread_count INT NOT NULL DEFAULT 0,
    message_unread_count INT NOT NULL DEFAULT 0,
    is_online BOOLEAN NOT NULL DEFAULT FALSE,
    last_seen_at TIMESTAMP WITHOUT TIME ZONE,
    deleted_at TIMESTAMP WITHOUT TIME ZONE,
    PRIMARY KEY (conversation_id, user_id)
);

CREATE TABLE IF NOT EXISTS social_messages (
    message_id VARCHAR(64) PRIMARY KEY,
    conversation_id VARCHAR(64) NOT NULL,
    sender_user_id VARCHAR(64),
    sender_role VARCHAR(24) NOT NULL DEFAULT 'customer',
    body TEXT,
    body_format VARCHAR(16) NOT NULL DEFAULT 'plain',
    type VARCHAR(24) NOT NULL DEFAULT 'text',
    reply_to_message_id VARCHAR(64),
    forwarded_from_message_id VARCHAR(64),
    link_preview JSONB,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    edited_at TIMESTAMP WITHOUT TIME ZONE,
    deleted_for_everyone_at TIMESTAMP WITHOUT TIME ZONE,
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS social_message_attachments (
    attachment_id VARCHAR(64) PRIMARY KEY,
    message_id VARCHAR(64) NOT NULL,
    uploader_user_id VARCHAR(64),
    kind VARCHAR(24) NOT NULL CHECK (kind IN ('image', 'video', 'file', 'voice', 'gif')),
    file_name VARCHAR(255),
    content_type VARCHAR(120),
    byte_size BIGINT NOT NULL DEFAULT 0,
    storage_key TEXT NOT NULL,
    public_url TEXT,
    width INT,
    height INT,
    duration_ms INT,
    checksum_sha256 VARCHAR(96),
    scan_status VARCHAR(24) NOT NULL DEFAULT 'pending',
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS social_message_receipts (
    message_id VARCHAR(64) NOT NULL,
    user_id VARCHAR(64) NOT NULL,
    delivered_at TIMESTAMP WITHOUT TIME ZONE,
    read_at TIMESTAMP WITHOUT TIME ZONE,
    deleted_for_self_at TIMESTAMP WITHOUT TIME ZONE,
    PRIMARY KEY (message_id, user_id)
);

CREATE TABLE IF NOT EXISTS social_reactions (
    reaction_id VARCHAR(64) PRIMARY KEY,
    target_type VARCHAR(24) NOT NULL CHECK (target_type IN ('message', 'comment')),
    target_id VARCHAR(64) NOT NULL,
    user_id VARCHAR(64) NOT NULL,
    reaction VARCHAR(16) NOT NULL CHECK (reaction IN ('like', 'love', 'care', 'haha', 'wow', 'sad', 'angry')),
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (target_type, target_id, user_id)
);

CREATE TABLE IF NOT EXISTS social_reaction_counts (
    target_type VARCHAR(24) NOT NULL,
    target_id VARCHAR(64) NOT NULL,
    reaction VARCHAR(16) NOT NULL,
    count INT NOT NULL DEFAULT 0,
    updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (target_type, target_id, reaction)
);

CREATE TABLE IF NOT EXISTS social_comment_threads (
    thread_id VARCHAR(64) PRIMARY KEY,
    target_type VARCHAR(40) NOT NULL,
    target_id VARCHAR(64) NOT NULL,
    status VARCHAR(24) NOT NULL DEFAULT 'open',
    comment_count INT NOT NULL DEFAULT 0,
    last_comment_at TIMESTAMP WITHOUT TIME ZONE,
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS social_comments (
    comment_id VARCHAR(64) PRIMARY KEY,
    thread_id VARCHAR(64) NOT NULL,
    parent_comment_id VARCHAR(64),
    author_user_id VARCHAR(64),
    author_role VARCHAR(24) NOT NULL DEFAULT 'customer',
    body TEXT NOT NULL,
    body_format VARCHAR(16) NOT NULL DEFAULT 'plain',
    path VARCHAR(1000),
    depth INT NOT NULL DEFAULT 0,
    reply_count INT NOT NULL DEFAULT 0,
    like_count INT NOT NULL DEFAULT 0,
    relevance_score NUMERIC(12, 4) NOT NULL DEFAULT 0,
    edited_at TIMESTAMP WITHOUT TIME ZONE,
    deleted_at TIMESTAMP WITHOUT TIME ZONE,
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS social_mentions (
    mention_id VARCHAR(64) PRIMARY KEY,
    source_type VARCHAR(24) NOT NULL CHECK (source_type IN ('message', 'comment', 'task', 'order')),
    source_id VARCHAR(64) NOT NULL,
    conversation_id VARCHAR(64),
    thread_id VARCHAR(64),
    mentioned_user_id VARCHAR(64),
    mentioned_role VARCHAR(32),
    mentioned_username VARCHAR(80),
    created_by_user_id VARCHAR(64),
    priority VARCHAR(16) NOT NULL DEFAULT 'normal',
    escalation_due_at TIMESTAMP WITHOUT TIME ZONE,
    acknowledged_at TIMESTAMP WITHOUT TIME ZONE,
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS social_notifications (
    notification_id VARCHAR(64) PRIMARY KEY,
    recipient_user_id VARCHAR(64) NOT NULL,
    actor_user_id VARCHAR(64),
    type VARCHAR(40) NOT NULL,
    title VARCHAR(180) NOT NULL,
    body TEXT,
    group_key VARCHAR(120),
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    priority VARCHAR(16) NOT NULL DEFAULT 'normal',
    read_at TIMESTAMP WITHOUT TIME ZONE,
    delivered_at TIMESTAMP WITHOUT TIME ZONE,
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS social_typing_status (
    conversation_id VARCHAR(64) NOT NULL,
    user_id VARCHAR(64) NOT NULL,
    expires_at TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (conversation_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_social_conversations_last_message
    ON social_conversations (last_message_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_social_conversation_members_user
    ON social_conversation_members (user_id, deleted_at, message_unread_count DESC);
CREATE INDEX IF NOT EXISTS idx_social_messages_conversation_page
    ON social_messages (conversation_id, created_at DESC, message_id DESC);
CREATE INDEX IF NOT EXISTS idx_social_messages_search
    ON social_messages USING GIN (to_tsvector('simple', coalesce(body, '')));
CREATE INDEX IF NOT EXISTS idx_social_attachments_message
    ON social_message_attachments (message_id);
CREATE INDEX IF NOT EXISTS idx_social_receipts_user_unread
    ON social_message_receipts (user_id, read_at, delivered_at);
CREATE INDEX IF NOT EXISTS idx_social_reactions_target
    ON social_reactions (target_type, target_id, reaction);
CREATE INDEX IF NOT EXISTS idx_social_comment_threads_target
    ON social_comment_threads (target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_social_comments_thread_sort
    ON social_comments (thread_id, created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_social_comments_parent
    ON social_comments (parent_comment_id, created_at ASC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_social_mentions_assignee
    ON social_mentions (mentioned_user_id, acknowledged_at, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_social_mentions_role
    ON social_mentions (mentioned_role, priority, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_social_notifications_recipient_unread
    ON social_notifications (recipient_user_id, read_at, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_social_notifications_group
    ON social_notifications (recipient_user_id, group_key, created_at DESC);
