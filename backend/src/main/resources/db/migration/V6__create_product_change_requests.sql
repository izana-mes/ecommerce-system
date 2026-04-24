CREATE TABLE IF NOT EXISTS product_change_requests (
    product_change_requests_id UUID PRIMARY KEY,
    action_type VARCHAR(30) NOT NULL,
    target_product_id VARCHAR(50),
    request_payload TEXT NOT NULL,
    status VARCHAR(20) NOT NULL,
    requested_by_user_id UUID NOT NULL REFERENCES users (users_id) ON DELETE CASCADE,
    reviewed_by_user_id UUID REFERENCES users (users_id) ON DELETE SET NULL,
    reviewer_note VARCHAR(1000),
    reviewed_at TIMESTAMP WITHOUT TIME ZONE,
    created_at TIMESTAMP WITHOUT TIME ZONE,
    updated_at TIMESTAMP WITHOUT TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_product_change_requests_status_created_at
    ON product_change_requests (status, created_at);

CREATE INDEX IF NOT EXISTS idx_product_change_requests_requested_by
    ON product_change_requests (requested_by_user_id);

