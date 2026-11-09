-- V52: Extend product change request lifecycle with CHANGES_REQUESTED status.
--
-- The product_change_requests.status column is VARCHAR(20).
-- New status value: CHANGES_REQUESTED (17 chars, within limit).
--
-- No DDL changes required; the new enum value is stored as a plain string.
-- This migration documents the intent and ensures Flyway tracks the schema version.
--
-- Moderation lifecycle:
--   PENDING -> APPROVED        (admin approves, change is applied)
--   PENDING -> REJECTED        (admin rejects, rejection reason stored in reviewer_note)
--   PENDING -> CHANGES_REQUESTED (admin requests corrections, feedback in reviewer_note)
--   CHANGES_REQUESTED -> PENDING (submitter resubmits after making corrections)

-- Add check constraint safely/idempotently if it does not already exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'chk_product_change_request_status'
    ) THEN
        ALTER TABLE product_change_requests
            ADD CONSTRAINT chk_product_change_request_status
            CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'CHANGES_REQUESTED'));
    END IF;
END $$;
