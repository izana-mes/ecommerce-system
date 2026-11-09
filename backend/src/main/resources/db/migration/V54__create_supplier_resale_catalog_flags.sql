-- V54: Supplier resale catalog flags
-- Controls which Supplier products are visible to Sellers for resale discovery.
-- A Supplier must explicitly opt-in a product before Sellers can browse or request it.

CREATE TABLE IF NOT EXISTS supplier_resale_catalog_flags (
    id                  BIGSERIAL PRIMARY KEY,
    product_id          VARCHAR(50)  NOT NULL,
    supplier_user_id    UUID         NOT NULL REFERENCES users(users_id) ON DELETE CASCADE,
    resale_enabled      BOOLEAN      NOT NULL DEFAULT FALSE,
    commercial_note     TEXT,
    created_at          TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT uq_resale_flag_product UNIQUE (product_id),
    CONSTRAINT fk_resale_flag_product FOREIGN KEY (product_id)
        REFERENCES products(product_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_resale_flag_supplier_enabled
    ON supplier_resale_catalog_flags(supplier_user_id, resale_enabled);

CREATE INDEX IF NOT EXISTS idx_resale_flag_enabled
    ON supplier_resale_catalog_flags(resale_enabled)
    WHERE resale_enabled = TRUE;
