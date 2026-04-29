ALTER TABLE orders
    ADD COLUMN IF NOT EXISTS delivery_latitude NUMERIC(10, 7),
    ADD COLUMN IF NOT EXISTS delivery_longitude NUMERIC(10, 7),
    ADD COLUMN IF NOT EXISTS delivery_location_label VARCHAR(255),
    ADD COLUMN IF NOT EXISTS delivery_location_accuracy_meters NUMERIC(10, 2),
    ADD COLUMN IF NOT EXISTS delivery_location_captured_at BIGINT;

CREATE TABLE IF NOT EXISTS attendance_action_logs (
    action_log_id VARCHAR(64) PRIMARY KEY,
    shift_id VARCHAR(64) NULL,
    employee_user_id VARCHAR(64) NOT NULL,
    employee_email VARCHAR(255) NOT NULL,
    employee_name VARCHAR(255) NOT NULL,
    action_type VARCHAR(32) NOT NULL,
    note TEXT NULL,
    location_label VARCHAR(255) NULL,
    latitude NUMERIC(10, 7) NOT NULL,
    longitude NUMERIC(10, 7) NOT NULL,
    accuracy_meters NUMERIC(10, 2) NULL,
    client_recorded_at BIGINT NULL,
    recorded_at BIGINT NOT NULL,
    created_at BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_attendance_action_logs_employee_recorded
    ON attendance_action_logs (employee_user_id, recorded_at DESC);

CREATE INDEX IF NOT EXISTS idx_attendance_action_logs_shift_recorded
    ON attendance_action_logs (shift_id, recorded_at DESC);
