-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users Table
CREATE TABLE users (
    users_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    phone VARCHAR(20) UNIQUE,
    username VARCHAR(100) UNIQUE,
    is_active BOOLEAN DEFAULT TRUE,
    email_verified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP,
    updated_at TIMESTAMP
);

-- Roles Table
CREATE TABLE roles (
    roles_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(50) NOT NULL UNIQUE,
    description VARCHAR(255),
    created_at TIMESTAMP,
    updated_at TIMESTAMP
);

-- User Roles Junction Table
CREATE TABLE user_roles (
    users_id UUID NOT NULL,
    roles_id UUID NOT NULL,
    PRIMARY KEY (users_id, roles_id),
    FOREIGN KEY (users_id) REFERENCES users(users_id) ON DELETE CASCADE,
    FOREIGN KEY (roles_id) REFERENCES roles(roles_id) ON DELETE CASCADE
);

-- Refresh Tokens Table
CREATE TABLE refresh_tokens (
    refresh_token_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    users_id UUID NOT NULL,
    token_hash TEXT NOT NULL,
    is_revoked BOOLEAN DEFAULT FALSE,
    expires_at TIMESTAMP NOT NULL,
    last_used_at TIMESTAMP,
    created_at TIMESTAMP,
    updated_at TIMESTAMP,
    FOREIGN KEY (users_id) REFERENCES users(users_id) ON DELETE CASCADE
);

-- Email Verification Tokens Table
CREATE TABLE email_verification_tokens (
    verification_token_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    users_id UUID NOT NULL,
    token_hash TEXT NOT NULL,
    is_used BOOLEAN DEFAULT FALSE,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP,
    updated_at TIMESTAMP,
    FOREIGN KEY (users_id) REFERENCES users(users_id) ON DELETE CASCADE
);

-- Password Reset Tokens Table
CREATE TABLE password_reset_tokens (
    password_reset_token_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    users_id UUID NOT NULL,
    token_hash TEXT NOT NULL,
    is_used BOOLEAN DEFAULT FALSE,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP,
    updated_at TIMESTAMP,
    FOREIGN KEY (users_id) REFERENCES users(users_id) ON DELETE CASCADE
);

-- Indexes
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_refresh_tokens_hash ON refresh_tokens(token_hash);
CREATE INDEX idx_email_verification_hash ON email_verification_tokens(token_hash);
CREATE INDEX idx_password_reset_hash ON password_reset_tokens(token_hash);

-- Initial Data
INSERT INTO roles (name, description, created_at, updated_at) VALUES 
('ROLE_USER', 'Standard user role', NOW(), NOW()),
('ROLE_ADMIN', 'Administrator role', NOW(), NOW())
ON CONFLICT (name) DO NOTHING;
