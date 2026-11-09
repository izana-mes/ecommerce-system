-- V56: Seller resale authorizations
-- Records an accepted partnership between a Seller and Supplier for a specific product.
-- Soft-revocable: revoked authorizations are preserved for audit purposes.
-- An accepted request creates exactly one authorization.

CREATE TABLE IF NOT EXISTS seller_resale_authorizations (
    id                  UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    resale_request_id   UUID         NOT NULL REFERENCES seller_resale_requests(id) ON DELETE RESTRICT,
    supplier_product_id VARCHAR(50)  NOT NULL,
    seller_user_id      UUID         NOT NULL REFERENCES users(users_id) ON DELETE CASCADE,
    supplier_user_id    UUID         NOT NULL REFERENCES users(users_id) ON DELETE CASCADE,
    granted_by_user_id  UUID         REFERENCES users(users_id) ON DELETE SET NULL,
    granted_at          TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    is_active           BOOLEAN      NOT NULL DEFAULT TRUE,
    revoked_at          TIMESTAMP WITHOUT TIME ZONE,
    revoked_by_user_id  UUID         REFERENCES users(users_id) ON DELETE SET NULL,
    revoke_reason       TEXT,
    created_at          TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_resale_auth_product FOREIGN KEY (supplier_product_id)
        REFERENCES products(product_id) ON DELETE RESTRICT,

    -- One active authorization per Seller/Product pair
    CONSTRAINT uq_resale_auth_seller_product_active UNIQUE (seller_user_id, supplier_product_id, is_active)
);

CREATE INDEX IF NOT EXISTS idx_resale_auth_seller_active
    ON seller_resale_authorizations(seller_user_id, is_active);

CREATE INDEX IF NOT EXISTS idx_resale_auth_supplier
    ON seller_resale_authorizations(supplier_user_id, is_active, granted_at DESC);

CREATE INDEX IF NOT EXISTS idx_resale_auth_product
    ON seller_resale_authorizations(supplier_product_id, is_active);

CREATE INDEX IF NOT EXISTS idx_resale_auth_request
    ON seller_resale_authorizations(resale_request_id);
