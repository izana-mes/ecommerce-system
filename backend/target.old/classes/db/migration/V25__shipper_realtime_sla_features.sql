ALTER TABLE orders
    ADD COLUMN IF NOT EXISTS shipper_user_id UUID REFERENCES users(users_id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS expected_delivery_at TIMESTAMP,
    ADD COLUMN IF NOT EXISTS picked_up_at TIMESTAMP,
    ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMP,
    ADD COLUMN IF NOT EXISTS failed_at TIMESTAMP,
    ADD COLUMN IF NOT EXISTS delivery_success BOOLEAN,
    ADD COLUMN IF NOT EXISTS failure_reason VARCHAR(400);

CREATE INDEX IF NOT EXISTS idx_orders_shipper_user_id ON orders(shipper_user_id);
CREATE INDEX IF NOT EXISTS idx_orders_expected_delivery_at ON orders(expected_delivery_at);

CREATE TABLE IF NOT EXISTS shipper_location_history (
    id BIGSERIAL PRIMARY KEY,
    shipper_user_id UUID NOT NULL REFERENCES users(users_id) ON DELETE CASCADE,
    order_id BIGINT REFERENCES orders(id) ON DELETE SET NULL,
    latitude NUMERIC(10, 7) NOT NULL,
    longitude NUMERIC(10, 7) NOT NULL,
    speed NUMERIC(10, 2),
    heading NUMERIC(10, 2),
    accuracy_meters NUMERIC(10, 2),
    source VARCHAR(20) NOT NULL DEFAULT 'WS',
    recorded_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_shipper_location_history_shipper_time
    ON shipper_location_history(shipper_user_id, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_shipper_location_history_order_time
    ON shipper_location_history(order_id, recorded_at DESC);

CREATE TABLE IF NOT EXISTS shipper_issue_logs (
    id BIGSERIAL PRIMARY KEY,
    order_id BIGINT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    shipper_user_id UUID NOT NULL REFERENCES users(users_id) ON DELETE CASCADE,
    issue_type VARCHAR(50) NOT NULL,
    message VARCHAR(1200),
    status VARCHAR(20) NOT NULL DEFAULT 'OPEN',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_shipper_issue_logs_order_id ON shipper_issue_logs(order_id);
CREATE INDEX IF NOT EXISTS idx_shipper_issue_logs_shipper_id ON shipper_issue_logs(shipper_user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS shipper_help_requests (
    id BIGSERIAL PRIMARY KEY,
    order_id BIGINT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    shipper_user_id UUID NOT NULL REFERENCES users(users_id) ON DELETE CASCADE,
    message VARCHAR(1200) NOT NULL,
    priority VARCHAR(20) NOT NULL DEFAULT 'NORMAL',
    status VARCHAR(20) NOT NULL DEFAULT 'OPEN',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_shipper_help_requests_order_id ON shipper_help_requests(order_id);
CREATE INDEX IF NOT EXISTS idx_shipper_help_requests_shipper_id ON shipper_help_requests(shipper_user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS order_status_logs (
    id BIGSERIAL PRIMARY KEY,
    order_id BIGINT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    previous_status VARCHAR(30),
    new_status VARCHAR(30) NOT NULL,
    note VARCHAR(1000),
    changed_by VARCHAR(255) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_order_status_logs_order_id ON order_status_logs(order_id, created_at DESC);
