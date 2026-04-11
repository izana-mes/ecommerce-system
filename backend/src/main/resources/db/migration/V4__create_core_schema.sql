-- Core auth, catalog, tokens, wishlist, and cart. Render DB had V2/V3 (orders/audit) but no user/catalog tables.

CREATE TABLE IF NOT EXISTS users (
    users_id UUID PRIMARY KEY,
    username VARCHAR(100) UNIQUE,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    phone VARCHAR(20) UNIQUE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    email_verified BOOLEAN NOT NULL DEFAULT FALSE,
    auth_provider VARCHAR(30),
    provider_id VARCHAR(255),
    created_at TIMESTAMP WITHOUT TIME ZONE,
    updated_at TIMESTAMP WITHOUT TIME ZONE
);

CREATE TABLE IF NOT EXISTS roles (
    roles_id UUID PRIMARY KEY,
    roles_name VARCHAR(50) NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS user_roles (
    users_id UUID NOT NULL REFERENCES users (users_id) ON DELETE CASCADE,
    roles_id UUID NOT NULL REFERENCES roles (roles_id) ON DELETE CASCADE,
    PRIMARY KEY (users_id, roles_id)
);

CREATE TABLE IF NOT EXISTS products (
    id BIGSERIAL PRIMARY KEY,
    product_id VARCHAR(50) NOT NULL UNIQUE,
    front_img TEXT NOT NULL,
    back_img TEXT,
    product_name VARCHAR(500) NOT NULL,
    product_price DOUBLE PRECISION NOT NULL,
    product_reviews TEXT,
    stock_quantity INTEGER NOT NULL DEFAULT 25,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITHOUT TIME ZONE,
    updated_at TIMESTAMP WITHOUT TIME ZONE
);

CREATE TABLE IF NOT EXISTS otp_verification (
    otp_verification_id UUID PRIMARY KEY,
    email VARCHAR(150) NOT NULL,
    otp_code VARCHAR(6) NOT NULL,
    is_used BOOLEAN NOT NULL DEFAULT FALSE,
    expires_at TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    created_at TIMESTAMP WITHOUT TIME ZONE,
    updated_at TIMESTAMP WITHOUT TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_otp_email ON otp_verification (email);
CREATE INDEX IF NOT EXISTS idx_otp_expires_at ON otp_verification (expires_at);

CREATE TABLE IF NOT EXISTS refresh_tokens (
    refresh_tokens_id UUID PRIMARY KEY,
    users_id UUID NOT NULL REFERENCES users (users_id) ON DELETE CASCADE,
    refresh_tokens_hash TEXT NOT NULL,
    is_revoked BOOLEAN NOT NULL DEFAULT FALSE,
    expires_at TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    last_used_at TIMESTAMP WITHOUT TIME ZONE,
    created_at TIMESTAMP WITHOUT TIME ZONE
);

CREATE TABLE IF NOT EXISTS email_verification_tokens (
    verification_token_id UUID PRIMARY KEY,
    users_id UUID NOT NULL REFERENCES users (users_id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL,
    is_used BOOLEAN NOT NULL DEFAULT FALSE,
    expires_at TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    created_at TIMESTAMP WITHOUT TIME ZONE,
    updated_at TIMESTAMP WITHOUT TIME ZONE
);

CREATE TABLE IF NOT EXISTS password_reset_tokens (
    password_reset_tokens_id UUID PRIMARY KEY,
    users_id UUID NOT NULL REFERENCES users (users_id) ON DELETE CASCADE,
    tokens_hash TEXT NOT NULL,
    is_used BOOLEAN NOT NULL DEFAULT FALSE,
    expires_at TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    created_at TIMESTAMP WITHOUT TIME ZONE
);

CREATE TABLE IF NOT EXISTS wishlist_items (
    id BIGSERIAL PRIMARY KEY,
    product_id VARCHAR(50) NOT NULL,
    product_name VARCHAR(500) NOT NULL,
    product_price DOUBLE PRECISION NOT NULL,
    product_reviews VARCHAR(2000),
    created_at TIMESTAMP WITHOUT TIME ZONE,
    updated_at TIMESTAMP WITHOUT TIME ZONE,
    user_id UUID NOT NULL REFERENCES users (users_id) ON DELETE CASCADE,
    CONSTRAINT uq_wishlist_items_user_product UNIQUE (user_id, product_id)
);

CREATE INDEX IF NOT EXISTS idx_wishlist_items_user_id ON wishlist_items (user_id);

CREATE TABLE IF NOT EXISTS cart_items (
    id BIGSERIAL PRIMARY KEY,
    product_id VARCHAR(50) NOT NULL,
    product_name VARCHAR(255) NOT NULL,
    product_price DOUBLE PRECISION NOT NULL,
    product_reviews VARCHAR(2000),
    quantity INTEGER NOT NULL,
    created_at TIMESTAMP WITHOUT TIME ZONE,
    updated_at TIMESTAMP WITHOUT TIME ZONE,
    user_id UUID NOT NULL REFERENCES users (users_id) ON DELETE CASCADE,
    CONSTRAINT uq_cart_items_user_product UNIQUE (user_id, product_id)
);

CREATE INDEX IF NOT EXISTS idx_cart_items_user_id ON cart_items (user_id);
CREATE INDEX IF NOT EXISTS idx_cart_items_product_id ON cart_items (product_id);
