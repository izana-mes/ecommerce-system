ALTER TABLE refresh_tokens
    ADD COLUMN IF NOT EXISTS token_family_id UUID,
    ADD COLUMN IF NOT EXISTS parent_token_id UUID,
    ADD COLUMN IF NOT EXISTS replaced_by_token_id UUID,
    ADD COLUMN IF NOT EXISTS issued_at TIMESTAMP WITHOUT TIME ZONE,
    ADD COLUMN IF NOT EXISTS revoked_at TIMESTAMP WITHOUT TIME ZONE,
    ADD COLUMN IF NOT EXISTS reuse_detected_at TIMESTAMP WITHOUT TIME ZONE,
    ADD COLUMN IF NOT EXISTS revocation_reason VARCHAR(64),
    ADD COLUMN IF NOT EXISTS issued_ip VARCHAR(128),
    ADD COLUMN IF NOT EXISTS issued_user_agent VARCHAR(1024),
    ADD COLUMN IF NOT EXISTS device_id VARCHAR(256),
    ADD COLUMN IF NOT EXISTS entity_version BIGINT NOT NULL DEFAULT 0;

UPDATE refresh_tokens
SET token_family_id = COALESCE(token_family_id, refresh_tokens_id),
    issued_at = COALESCE(issued_at, created_at, NOW())
WHERE token_family_id IS NULL OR issued_at IS NULL;

ALTER TABLE refresh_tokens
    ALTER COLUMN token_family_id SET NOT NULL,
    ALTER COLUMN issued_at SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_refresh_tokens_hash_unique ON refresh_tokens(refresh_tokens_hash);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_family ON refresh_tokens(token_family_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_active ON refresh_tokens(users_id, is_revoked, expires_at);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_replaced_by ON refresh_tokens(replaced_by_token_id);
