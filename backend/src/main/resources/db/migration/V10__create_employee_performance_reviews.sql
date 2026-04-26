CREATE TABLE IF NOT EXISTS employee_performance_reviews (
    review_id VARCHAR(64) PRIMARY KEY,
    employee_user_id VARCHAR(64) NOT NULL,
    employee_email VARCHAR(255) NOT NULL,
    employee_name VARCHAR(255) NOT NULL,
    review_type VARCHAR(32) NOT NULL,
    category VARCHAR(64) NOT NULL,
    title VARCHAR(160) NOT NULL,
    summary TEXT NOT NULL,
    review_status VARCHAR(32) NOT NULL DEFAULT 'OPEN',
    related_shift_id VARCHAR(64) NULL,
    source_key VARCHAR(160) NULL,
    last_notified_at BIGINT NULL,
    notification_count INT NOT NULL DEFAULT 0,
    created_by_user_id VARCHAR(64) NULL,
    created_by_email VARCHAR(255) NULL,
    created_at BIGINT NOT NULL,
    updated_at BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_employee_performance_reviews_employee
    ON employee_performance_reviews (employee_user_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_employee_performance_reviews_status
    ON employee_performance_reviews (review_status, updated_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_employee_performance_reviews_source_key
    ON employee_performance_reviews (source_key)
    WHERE source_key IS NOT NULL;
