-- Personal expense tracking for signed-in users (shopping & other spending).

CREATE TABLE IF NOT EXISTS user_expenses (
    id              BIGSERIAL PRIMARY KEY,
    user_id         UUID NOT NULL REFERENCES users (users_id) ON DELETE CASCADE,
    amount          NUMERIC(12, 2) NOT NULL,
    currency        CHAR(3) NOT NULL DEFAULT 'USD',
    category        VARCHAR(80) NOT NULL,
    description     VARCHAR(500),
    spent_on        DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_user_expenses_user_spent
    ON user_expenses (user_id, spent_on DESC, id DESC);
