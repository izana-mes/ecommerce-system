-- Seller finance: balances + ledger transactions

CREATE TABLE IF NOT EXISTS seller_balance (
    id BIGSERIAL PRIMARY KEY,
    seller_user_id UUID NOT NULL UNIQUE REFERENCES users (users_id) ON DELETE CASCADE,
    available_balance NUMERIC(19, 2) NOT NULL DEFAULT 0,
    pending_balance NUMERIC(19, 2) NOT NULL DEFAULT 0,
    total_earned NUMERIC(19, 2) NOT NULL DEFAULT 0,
    currency VARCHAR(3) NOT NULL DEFAULT 'USD',
    updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS seller_transactions (
    id BIGSERIAL PRIMARY KEY,
    seller_user_id UUID NOT NULL REFERENCES users (users_id) ON DELETE CASCADE,
    order_number VARCHAR(100),
    product_id VARCHAR(50),
    type VARCHAR(30) NOT NULL,
    gross_amount NUMERIC(19, 2) NOT NULL,
    commission_amount NUMERIC(19, 2) NOT NULL DEFAULT 0,
    net_amount NUMERIC(19, 2) NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_seller_transactions_seller_user_id
    ON seller_transactions (seller_user_id);

CREATE INDEX IF NOT EXISTS idx_seller_transactions_seller_created
    ON seller_transactions (seller_user_id, created_at);

