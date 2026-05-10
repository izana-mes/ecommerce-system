-- Hibernate 6.4 validates String columns as VARCHAR but the original migration
-- created currency as CHAR(3) (bpchar in PostgreSQL), causing a schema-validation
-- mismatch on startup. Converting to VARCHAR(3) aligns the DB with the entity mapping.
ALTER TABLE user_expenses
    ALTER COLUMN currency TYPE VARCHAR(3);
