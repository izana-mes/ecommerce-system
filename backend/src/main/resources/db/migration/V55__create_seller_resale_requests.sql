-- V55: Seller resale requests
-- A Seller submits a request to a Supplier for permission to resell a specific product.
-- Lifecycle: PENDING -> ACCEPTED | REJECTED
--            PENDING -> CANCELLED (Seller cancels before decision)

CREATE TABLE IF NOT EXISTS seller_resale_requests (
    id                  UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    supplier_product_id VARCHAR(50)  NOT NULL,
    seller_user_id      UUID         NOT NULL REFERENCES users(users_id) ON DELETE CASCADE,
    supplier_user_id    UUID         NOT NULL REFERENCES users(users_id) ON DELETE CASCADE,
    proposal_message    TEXT,
    proposed_retail_price NUMERIC(12,2),
    status              VARCHAR(20)  NOT NULL DEFAULT 'PENDING',
    reviewer_user_id    UUID         REFERENCES users(users_id) ON DELETE SET NULL,
    reviewer_note       TEXT,
    reviewed_at         TIMESTAMP WITHOUT TIME ZONE,
    cancelled_at        TIMESTAMP WITHOUT TIME ZONE,
    cancel_reason       TEXT,
    created_at          TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_resale_req_product FOREIGN KEY (supplier_product_id)
        REFERENCES products(product_id) ON DELETE CASCADE,

    -- Only one active (PENDING or ACCEPTED) request per Seller/Product pair
    CONSTRAINT chk_resale_request_status
        CHECK (status IN ('PENDING', 'ACCEPTED', 'REJECTED', 'CANCELLED'))
);

-- Prevent duplicate active requests: one PENDING per seller+product
CREATE UNIQUE INDEX IF NOT EXISTS uq_resale_req_seller_product_pending
    ON seller_resale_requests(seller_user_id, supplier_product_id)
    WHERE status = 'PENDING';

CREATE INDEX IF NOT EXISTS idx_resale_req_supplier_status
    ON seller_resale_requests(supplier_user_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_resale_req_seller_status
    ON seller_resale_requests(seller_user_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_resale_req_product
    ON seller_resale_requests(supplier_product_id, status);
