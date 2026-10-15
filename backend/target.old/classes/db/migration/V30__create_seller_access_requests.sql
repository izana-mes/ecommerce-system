CREATE TABLE IF NOT EXISTS seller_access_requests (
    seller_access_requests_id UUID PRIMARY KEY,
    requested_by_user_id UUID NOT NULL REFERENCES users (users_id) ON DELETE CASCADE,
    business_name VARCHAR(255),
    website_url VARCHAR(500),
    contact_phone VARCHAR(50),
    note VARCHAR(1000),
    status VARCHAR(20) NOT NULL,
    reviewed_by_user_id UUID REFERENCES users (users_id) ON DELETE SET NULL,
    reviewer_note VARCHAR(1000),
    reviewed_at TIMESTAMP WITHOUT TIME ZONE,
    created_at TIMESTAMP WITHOUT TIME ZONE,
    updated_at TIMESTAMP WITHOUT TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_seller_access_requests_status_created_at
    ON seller_access_requests (status, created_at);

CREATE INDEX IF NOT EXISTS idx_seller_access_requests_requested_by
    ON seller_access_requests (requested_by_user_id);
