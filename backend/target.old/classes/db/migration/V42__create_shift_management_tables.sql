CREATE TABLE IF NOT EXISTS shifts (
    id UUID PRIMARY KEY,
    assignee_user_id UUID NOT NULL REFERENCES users (users_id) ON DELETE CASCADE,
    assignee_code VARCHAR(100) NOT NULL,
    assignee_role VARCHAR(30) NOT NULL,
    shift_date DATE NOT NULL,
    start_at TIMESTAMP WITH TIME ZONE NOT NULL,
    end_at TIMESTAMP WITH TIME ZONE NOT NULL,
    timezone VARCHAR(80) NOT NULL DEFAULT 'UTC',
    location VARCHAR(255) NOT NULL,
    note TEXT,
    status VARCHAR(30) NOT NULL DEFAULT 'PENDING',
    source VARCHAR(30) NOT NULL DEFAULT 'MANUAL',
    import_batch_id UUID,
    created_by UUID REFERENCES users (users_id) ON DELETE SET NULL,
    updated_by UUID REFERENCES users (users_id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_shifts_role CHECK (assignee_role IN ('EMPLOYEE', 'SHIPPER')),
    CONSTRAINT chk_shifts_status CHECK (status IN ('PENDING', 'ACCEPTED', 'REJECTED', 'COMPLETED', 'ABSENT', 'SWAPPED')),
    CONSTRAINT chk_shifts_time CHECK (end_at > start_at)
);

CREATE INDEX IF NOT EXISTS idx_shifts_assignee_time ON shifts (assignee_user_id, start_at, end_at);
CREATE INDEX IF NOT EXISTS idx_shifts_range ON shifts (start_at, end_at);
CREATE INDEX IF NOT EXISTS idx_shifts_status ON shifts (status);
CREATE INDEX IF NOT EXISTS idx_shifts_import_batch ON shifts (import_batch_id);

CREATE TABLE IF NOT EXISTS shift_import_batches (
    id UUID PRIMARY KEY,
    file_name VARCHAR(255) NOT NULL,
    file_type VARCHAR(20) NOT NULL,
    status VARCHAR(30) NOT NULL,
    total_rows INTEGER NOT NULL DEFAULT 0,
    valid_rows INTEGER NOT NULL DEFAULT 0,
    invalid_rows INTEGER NOT NULL DEFAULT 0,
    imported_rows INTEGER NOT NULL DEFAULT 0,
    error_summary TEXT,
    created_by UUID REFERENCES users (users_id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_shift_import_batches_created_at ON shift_import_batches (created_at DESC);

CREATE TABLE IF NOT EXISTS shift_swap_requests (
    id UUID PRIMARY KEY,
    shift_id UUID NOT NULL REFERENCES shifts (id) ON DELETE CASCADE,
    requester_user_id UUID NOT NULL REFERENCES users (users_id) ON DELETE CASCADE,
    target_user_id UUID REFERENCES users (users_id) ON DELETE SET NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'PENDING',
    reason TEXT,
    reviewer_user_id UUID REFERENCES users (users_id) ON DELETE SET NULL,
    reviewer_note TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    reviewed_at TIMESTAMP WITH TIME ZONE,
    CONSTRAINT chk_shift_swap_status CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'))
);

CREATE TABLE IF NOT EXISTS shift_leave_requests (
    id UUID PRIMARY KEY,
    requester_user_id UUID NOT NULL REFERENCES users (users_id) ON DELETE CASCADE,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'PENDING',
    reason TEXT,
    reviewer_user_id UUID REFERENCES users (users_id) ON DELETE SET NULL,
    reviewer_note TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    reviewed_at TIMESTAMP WITH TIME ZONE,
    CONSTRAINT chk_shift_leave_dates CHECK (end_date >= start_date),
    CONSTRAINT chk_shift_leave_status CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'))
);

INSERT INTO roles (roles_id, roles_name)
VALUES
    ('11111111-1111-1111-1111-111111111101', 'ROLE_EMPLOYEE'),
    ('11111111-1111-1111-1111-111111111102', 'ROLE_SHIPPER')
ON CONFLICT (roles_name) DO NOTHING;

INSERT INTO users (users_id, username, email, password_hash, first_name, last_name, is_active, email_verified, created_at, updated_at)
VALUES
    ('22222222-2222-2222-2222-222222222201', 'EMP001', 'emp001@example.com', '$2a$10$7EqJtq98hPqEX7fNZaFWoOgw6H89g7LygScQ/9QVzMki3cT3TtG5G', 'Demo', 'Employee', TRUE, TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('22222222-2222-2222-2222-222222222202', 'SHP002', 'shp002@example.com', '$2a$10$7EqJtq98hPqEX7fNZaFWoOgw6H89g7LygScQ/9QVzMki3cT3TtG5G', 'Demo', 'Shipper', TRUE, TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT (email) DO NOTHING;

INSERT INTO user_roles (users_id, roles_id)
SELECT u.users_id, r.roles_id FROM users u, roles r
WHERE u.username = 'EMP001' AND r.roles_name = 'ROLE_EMPLOYEE'
ON CONFLICT DO NOTHING;

INSERT INTO user_roles (users_id, roles_id)
SELECT u.users_id, r.roles_id FROM users u, roles r
WHERE u.username = 'SHP002' AND r.roles_name = 'ROLE_SHIPPER'
ON CONFLICT DO NOTHING;

INSERT INTO shifts (id, assignee_user_id, assignee_code, assignee_role, shift_date, start_at, end_at, timezone, location, note, status, source)
SELECT '33333333-3333-3333-3333-333333333301', users_id, 'EMP001', 'EMPLOYEE', DATE '2026-05-28',
       TIMESTAMPTZ '2026-05-28 08:00:00+07', TIMESTAMPTZ '2026-05-28 17:00:00+07',
       'Asia/Ho_Chi_Minh', 'Hanoi', 'Morning shift', 'PENDING', 'MANUAL'
FROM users WHERE username = 'EMP001'
ON CONFLICT (id) DO NOTHING;

INSERT INTO shifts (id, assignee_user_id, assignee_code, assignee_role, shift_date, start_at, end_at, timezone, location, note, status, source)
SELECT '33333333-3333-3333-3333-333333333302', users_id, 'SHP002', 'SHIPPER', DATE '2026-05-28',
       TIMESTAMPTZ '2026-05-28 09:00:00+07', TIMESTAMPTZ '2026-05-28 18:00:00+07',
       'Asia/Ho_Chi_Minh', 'Cau Giay', 'Delivery shift', 'PENDING', 'MANUAL'
FROM users WHERE username = 'SHP002'
ON CONFLICT (id) DO NOTHING;
