-- V26: Supplier financial management tables

CREATE TABLE IF NOT EXISTS supplier_balance (
    id              BIGSERIAL PRIMARY KEY,
    supplier_user_id UUID NOT NULL UNIQUE,
    available_balance NUMERIC(19,2) NOT NULL DEFAULT 0,
    pending_balance   NUMERIC(19,2) NOT NULL DEFAULT 0,
    total_earned      NUMERIC(19,2) NOT NULL DEFAULT 0,
    currency          VARCHAR(3)    NOT NULL DEFAULT 'USD',
    updated_at        TIMESTAMP     NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS supplier_transactions (
    id               BIGSERIAL PRIMARY KEY,
    supplier_user_id UUID         NOT NULL,
    order_number     VARCHAR(100),
    product_id       VARCHAR(50),
    type             VARCHAR(30)  NOT NULL,
    gross_amount     NUMERIC(19,2) NOT NULL,
    commission_amount NUMERIC(19,2) NOT NULL DEFAULT 0,
    net_amount       NUMERIC(19,2) NOT NULL,
    description      TEXT,
    created_at       TIMESTAMP    NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_supplier_transactions_supplier_user_id
    ON supplier_transactions(supplier_user_id);

CREATE INDEX IF NOT EXISTS idx_supplier_transactions_created_at
    ON supplier_transactions(created_at DESC);
