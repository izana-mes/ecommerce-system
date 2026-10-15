CREATE TABLE IF NOT EXISTS attendance_shifts (
    shift_id VARCHAR(64) PRIMARY KEY,
    employee_email VARCHAR(255) NOT NULL,
    employee_name VARCHAR(255) NOT NULL,
    employee_role VARCHAR(50) NOT NULL,
    employee_user_id VARCHAR(64) NOT NULL,
    shift_date VARCHAR(10) NOT NULL,
    clock_in_at BIGINT NOT NULL,
    clock_out_at BIGINT NULL,
    total_work_minutes INT NOT NULL DEFAULT 0,
    total_break_minutes INT NOT NULL DEFAULT 0,
    note TEXT NULL,
    created_at BIGINT NOT NULL,
    updated_at BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_attendance_shifts_employee_open
    ON attendance_shifts (employee_user_id, clock_out_at, clock_in_at DESC);

CREATE INDEX IF NOT EXISTS idx_attendance_shifts_clock_in
    ON attendance_shifts (clock_in_at DESC);

CREATE INDEX IF NOT EXISTS idx_attendance_shifts_shift_date
    ON attendance_shifts (shift_date);

CREATE TABLE IF NOT EXISTS attendance_breaks (
    break_id VARCHAR(64) PRIMARY KEY,
    shift_id VARCHAR(64) NOT NULL,
    started_at BIGINT NOT NULL,
    ended_at BIGINT NULL,
    duration_minutes INT NOT NULL DEFAULT 0,
    created_at BIGINT NOT NULL,
    updated_at BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_attendance_breaks_shift
    ON attendance_breaks (shift_id, started_at ASC);
