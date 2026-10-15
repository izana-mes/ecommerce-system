CREATE TABLE IF NOT EXISTS shipper_incidents (
    id BIGSERIAL PRIMARY KEY,
    order_id BIGINT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    incident_type VARCHAR(40) NOT NULL,
    severity VARCHAR(20) NOT NULL DEFAULT 'MEDIUM',
    status VARCHAR(20) NOT NULL DEFAULT 'OPEN',
    details VARCHAR(1200),
    created_by VARCHAR(255) NOT NULL,
    resolved_by VARCHAR(255),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    resolved_at TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_shipper_incidents_order_id ON shipper_incidents (order_id);
CREATE INDEX IF NOT EXISTS idx_shipper_incidents_status ON shipper_incidents (status, created_at DESC);
