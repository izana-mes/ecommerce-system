CREATE TABLE IF NOT EXISTS admin_notes (
    id BIGSERIAL PRIMARY KEY,
    title VARCHAR(255),
    content TEXT,
    is_pinned BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP,
    updated_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_admin_notes_pinned_updated
    ON admin_notes (is_pinned DESC, updated_at DESC);
