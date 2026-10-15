CREATE TABLE IF NOT EXISTS order_analytics_events (
    order_id BIGINT PRIMARY KEY,
    order_number VARCHAR(40) NOT NULL,
    event_created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS order_analytics_daily (
    day DATE NOT NULL,
    currency CHAR(3) NOT NULL,
    payment_method VARCHAR(50) NOT NULL,
    orders_count BIGINT NOT NULL DEFAULT 0,
    gross_revenue NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
    updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (day, currency, payment_method)
);
