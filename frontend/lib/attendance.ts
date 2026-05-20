import { getConnection } from "@/lib/db";
import { backendApiBaseUrl } from "@/lib/backendApiBase";

const MINUTE_MS = 60_000;
const DAY_MS = 24 * 60 * 60 * 1000;
const ATTENDANCE_TIMEZONE = process.env.ATTENDANCE_TIMEZONE || "UTC";

export type AttendanceAction = "clock_in" | "clock_out" | "start_break" | "end_break";

export type EmployeeIdentity = {
  email: string;
  displayName: string;
  role: string;
  userId: string;
};

type AttendanceShiftRow = {
  shift_id: string;
  employee_email: string;
  employee_name: string;
  employee_role: string;
  employee_user_id?: string;
  shift_date: string;
  clock_in_at: number;
  clock_out_at: number | null;
  total_work_minutes: number;
  total_break_minutes: number;
  note: string | null;
  created_at: number;
  updated_at: number;
};

type AttendanceBreakRow = {
  break_id: string;
  shift_id: string;
  started_at: number;
  ended_at: number | null;
  duration_minutes: number;
  created_at: number;
  updated_at: number;
};

type AdminAttendanceShiftRow = AttendanceShiftRow & {
  has_open_break?: number | boolean;
};

type SnapshotShift = {
  shiftId: string;
  shiftDate: string;
  clockInAt: number;
  clockOutAt: number | null;
  totalWorkMinutes: number;
  totalBreakMinutes: number;
  status: "open" | "closed";
  note: string | null;
};

type OpenShiftInfo = {
  shiftId: string;
  clockInAt: number;
  shiftDate: string;
};

export type AttendanceSnapshot = {
  employee: {
    email: string;
    name: string;
    role: string;
    userId: string;
  };
  timezone: string;
  generatedAt: number;
  status: "CLOCKED_OUT" | "CLOCKED_IN";
  onBreak: boolean;
  openShift: OpenShiftInfo | null;
  liveWorkedMinutes: number;
  liveBreakMinutes: number;
  todayTotalMinutes: number;
  weekTotalMinutes: number;
  recentShifts: SnapshotShift[];
};

type AttendanceAdminStatus = "CLOCKED_OUT" | "CLOCKED_IN" | "ON_BREAK";

export type AdminAttendanceRecord = {
  shiftId: string;
  shiftDate: string;
  employee: {
    email: string;
    name: string;
    role: string;
    userId: string;
  };
  clockInAt: number;
  clockOutAt: number | null;
  totalWorkMinutes: number;
  totalBreakMinutes: number;
  status: AttendanceAdminStatus;
  note: string | null;
};

export type AdminAttendanceFilters = {
  query?: string;
  status?: "all" | "active" | "on_break" | "closed";
  dateFrom?: string;
  dateTo?: string;
  limit?: number;
};

export type AdminAttendanceSnapshot = {
  timezone: string;
  generatedAt: number;
  summary: {
    employeesTracked: number;
    activeEmployees: number;
    employeesOnBreak: number;
    todayWorkedMinutes: number;
    weekWorkedMinutes: number;
  };
  activeShifts: AdminAttendanceRecord[];
  records: AdminAttendanceRecord[];
};

type BackendMeResponse = {
  data?: {
    id?: number | string;
    email?: string;
    firstName?: string;
    lastName?: string;
    role?: string;
    roles?: string[];
  };
};

function sanitizeNote(note: unknown): string | null {
  if (typeof note !== "string") return null;
  const trimmed = note.trim();
  return trimmed.length > 0 ? trimmed.slice(0, 400) : null;
}

function dateKeyFromTimestamp(timestamp: number): string {
  const dtf = new Intl.DateTimeFormat("en-CA", {
    timeZone: ATTENDANCE_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"});
  return dtf.format(new Date(timestamp));
}

function minutesBetween(startMs: number, endMs: number): number {
  if (endMs <= startMs) return 0;
  return Math.floor((endMs - startMs) / MINUTE_MS);
}

function makeId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function sumBreakMinutes(breaks: AttendanceBreakRow[], now: number): number {
  return breaks.reduce((total, br) => {
    const endAt = br.ended_at ?? now;
    return total + minutesBetween(br.started_at, endAt);
  }, 0);
}

function toShiftView(shift: AttendanceShiftRow): SnapshotShift {
  return {
    shiftId: shift.shift_id,
    shiftDate: shift.shift_date,
    clockInAt: Number(shift.clock_in_at),
    clockOutAt: shift.clock_out_at ? Number(shift.clock_out_at) : null,
    totalWorkMinutes: Number(shift.total_work_minutes || 0),
    totalBreakMinutes: Number(shift.total_break_minutes || 0),
    status: shift.clock_out_at ? "closed" : "open",
    note: shift.note};
}

function toAdminShiftStatus(shift: AttendanceShiftRow, hasOpenBreak: boolean): AttendanceAdminStatus {
  if (shift.clock_out_at) return "CLOCKED_OUT";
  return hasOpenBreak ? "ON_BREAK" : "CLOCKED_IN";
}

function toAdminRecord(shift: AttendanceShiftRow, hasOpenBreak: boolean): AdminAttendanceRecord {
  return {
    shiftId: shift.shift_id,
    shiftDate: shift.shift_date,
    employee: {
      email: shift.employee_email,
      name: shift.employee_name,
      role: shift.employee_role,
      userId: String(shift.employee_user_id ?? shift.employee_email)},
    clockInAt: Number(shift.clock_in_at),
    clockOutAt: shift.clock_out_at ? Number(shift.clock_out_at) : null,
    totalWorkMinutes: Number(shift.total_work_minutes || 0),
    totalBreakMinutes: Number(shift.total_break_minutes || 0),
    status: toAdminShiftStatus(shift, hasOpenBreak),
    note: shift.note};
}

async function toComputedAdminRecord(
  conn: Awaited<ReturnType<typeof getConnection>>,
  shift: AttendanceShiftRow,
  now: number,
  hasOpenBreakOverride?: boolean
): Promise<AdminAttendanceRecord> {
  if (shift.clock_out_at) {
    return toAdminRecord(shift, Boolean(hasOpenBreakOverride));
  }

  const breaks = await getShiftBreaks(conn, shift.shift_id);
  const totalBreakMinutes = sumBreakMinutes(breaks, now);
  const totalWorkMinutes = Math.max(
    0,
    minutesBetween(Number(shift.clock_in_at), now) - totalBreakMinutes
  );
  const hasOpenBreak =
    typeof hasOpenBreakOverride === "boolean"
      ? hasOpenBreakOverride
      : breaks.some((currentBreak) => currentBreak.ended_at === null);

  return {
    ...toAdminRecord(shift, hasOpenBreak),
    totalWorkMinutes,
    totalBreakMinutes};
}

function sanitizeDateInput(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(trimmed) ? trimmed : null;
}

async function ensureAttendanceTables(conn: Awaited<ReturnType<typeof getConnection>>) {
  await conn.execute(`
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
    )
  `);

  await conn.execute(`
    CREATE TABLE IF NOT EXISTS attendance_breaks (
      break_id VARCHAR(64) PRIMARY KEY,
      shift_id VARCHAR(64) NOT NULL,
      started_at BIGINT NOT NULL,
      ended_at BIGINT NULL,
      duration_minutes INT NOT NULL DEFAULT 0,
      created_at BIGINT NOT NULL,
      updated_at BIGINT NOT NULL
    )
  `);
}

async function getOpenShift(
  conn: Awaited<ReturnType<typeof getConnection>>,
  employeeUserId: string
): Promise<AttendanceShiftRow | null> {
  const [rows] = await conn.execute<AttendanceShiftRow[]>(
    `SELECT *
       FROM attendance_shifts
      WHERE employee_user_id = ?
        AND clock_out_at IS NULL
      ORDER BY clock_in_at DESC
      LIMIT 1`,
    [employeeUserId]
  );

  return rows?.[0] ?? null;
}

async function getShiftBreaks(
  conn: Awaited<ReturnType<typeof getConnection>>,
  shiftId: string
): Promise<AttendanceBreakRow[]> {
  const [rows] = await conn.execute<AttendanceBreakRow[]>(
    `SELECT *
       FROM attendance_breaks
      WHERE shift_id = ?
      ORDER BY started_at ASC`,
    [shiftId]
  );

  return rows || [];
}

export async function resolveEmployeeFromRequest(request: Request): Promise<EmployeeIdentity> {  const cookieHeader = request.headers.get("cookie");

  if (!cookieHeader) {
    throw new Error("Missing authentication headers.");
  }

  const response = await fetch(`${backendApiBaseUrl()}/v1/auth/me`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",      ...(cookieHeader ? { Cookie: cookieHeader } : {})}});

  const payload = (await response.json().catch(() => ({}))) as BackendMeResponse;
  if (!response.ok || !payload?.data?.email) {
    throw new Error("Unable to resolve authenticated employee.");
  }

  const profile = payload.data;
  const roleRaw = String(profile.role || "").toLowerCase();
  const roles = Array.isArray(profile.roles)
    ? profile.roles.map((value) => String(value).toUpperCase())
    : [];

  const allowed =
    roleRaw === "employee" ||
    roleRaw === "admin" ||
    roles.includes("ROLE_EMPLOYEE") ||
    roles.includes("ROLE_ADMIN") ||
    roles.includes("ROLE_STAFF");

  if (!allowed) {
    throw new Error("Forbidden. Attendance is for employees and admins only.");
  }

  const displayName =
    [profile.firstName, profile.lastName].filter(Boolean).join(" ").trim() || String(profile.email);
  const normalizedRole = roles.includes("ROLE_ADMIN")
    ? "admin"
    : roles.includes("ROLE_EMPLOYEE") || roles.includes("ROLE_STAFF")
      ? "employee"
      : roleRaw || "employee";

  return {
    email: String(profile.email),
    displayName,
    role: normalizedRole,
    userId: String(profile.id ?? profile.email)};
}

export async function resolveAdminFromRequest(request: Request): Promise<EmployeeIdentity> {
  const employee = await resolveEmployeeFromRequest(request);
  const normalizedRole = employee.role.toLowerCase();
  if (normalizedRole === "admin" || normalizedRole === "role_admin") {
    return employee;
  }
  throw new Error("Forbidden. Admin access is required.");
}

async function buildSnapshot(
  conn: Awaited<ReturnType<typeof getConnection>>,
  employee: EmployeeIdentity,
  now: number
): Promise<AttendanceSnapshot> {
  const [recentRows] = await conn.execute<AttendanceShiftRow[]>(
    `SELECT *
       FROM attendance_shifts
      WHERE employee_user_id = ?
      ORDER BY clock_in_at DESC
      LIMIT 25`,
    [employee.userId]
  );

  const openShift = recentRows?.find((row) => row.clock_out_at === null) || null;
  const openShiftBreaks = openShift ? await getShiftBreaks(conn, openShift.shift_id) : [];
  const hasOpenBreak = openShiftBreaks.some((br) => br.ended_at === null);

  const openShiftBreakMinutes = sumBreakMinutes(openShiftBreaks, now);
  const liveWorkedMinutes = openShift
    ? Math.max(0, minutesBetween(Number(openShift.clock_in_at), now) - openShiftBreakMinutes)
    : 0;

  const todayKey = dateKeyFromTimestamp(now);
  const todayTotalMinutes = (recentRows || []).reduce((total, shift) => {
    if (shift.shift_date !== todayKey) return total;
    if (shift.clock_out_at === null) {
      return total + liveWorkedMinutes;
    }
    return total + Number(shift.total_work_minutes || 0);
  }, 0);

  const weekCutoff = now - 6 * DAY_MS;
  const weekTotalMinutes = (recentRows || []).reduce((total, shift) => {
    const shiftStart = Number(shift.clock_in_at || 0);
    if (shiftStart < weekCutoff) return total;
    if (shift.clock_out_at === null) {
      return total + liveWorkedMinutes;
    }
    return total + Number(shift.total_work_minutes || 0);
  }, 0);

  return {
    employee: {
      email: employee.email,
      name: employee.displayName,
      role: employee.role,
      userId: employee.userId},
    timezone: ATTENDANCE_TIMEZONE,
    generatedAt: now,
    status: openShift ? "CLOCKED_IN" : "CLOCKED_OUT",
    onBreak: hasOpenBreak,
    openShift: openShift
      ? {
          shiftId: openShift.shift_id,
          clockInAt: Number(openShift.clock_in_at),
          shiftDate: openShift.shift_date}
      : null,
    liveWorkedMinutes,
    liveBreakMinutes: openShift ? openShiftBreakMinutes : 0,
    todayTotalMinutes,
    weekTotalMinutes,
    recentShifts: (recentRows || []).map(toShiftView)};
}

export async function getAttendanceSnapshot(employee: EmployeeIdentity): Promise<AttendanceSnapshot> {
  let conn: Awaited<ReturnType<typeof getConnection>> | undefined;
  const now = Date.now();
  try {
    conn = await getConnection();
    await ensureAttendanceTables(conn);
    return await buildSnapshot(conn, employee, now);
  } finally {
    await conn?.end();
  }
}

export async function applyAttendanceAction(
  employee: EmployeeIdentity,
  action: AttendanceAction,
  rawNote?: unknown
): Promise<AttendanceSnapshot> {
  const note = sanitizeNote(rawNote);
  let conn: Awaited<ReturnType<typeof getConnection>> | undefined;

  try {
    const now = Date.now();
    conn = await getConnection();
    await ensureAttendanceTables(conn);
    await conn.beginTransaction();

    const openShift = await getOpenShift(conn, employee.userId);

    if (action === "clock_in") {
      if (openShift) {
        throw new Error("You already have an active shift. Clock out before starting a new one.");
      }

      const shiftId = makeId("shift");
      await conn.execute(
        `INSERT INTO attendance_shifts (
          shift_id,
          employee_email,
          employee_name,
          employee_role,
          employee_user_id,
          shift_date,
          clock_in_at,
          clock_out_at,
          total_work_minutes,
          total_break_minutes,
          note,
          created_at,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, NULL, 0, 0, ?, ?, ?)`,
        [
          shiftId,
          employee.email,
          employee.displayName,
          employee.role,
          employee.userId,
          dateKeyFromTimestamp(now),
          now,
          note,
          now,
          now,
        ]
      );
    }

    if (action === "start_break") {
      if (!openShift) {
        throw new Error("No active shift. Clock in before starting a break.");
      }

      const existingBreaks = await getShiftBreaks(conn, openShift.shift_id);
      const hasOpenBreak = existingBreaks.some((br) => br.ended_at === null);
      if (hasOpenBreak) {
        throw new Error("A break is already active. End the current break first.");
      }

      const breakId = makeId("break");
      await conn.execute(
        `INSERT INTO attendance_breaks (
          break_id,
          shift_id,
          started_at,
          ended_at,
          duration_minutes,
          created_at,
          updated_at
        ) VALUES (?, ?, ?, NULL, 0, ?, ?)`,
        [breakId, openShift.shift_id, now, now, now]
      );
    }

    if (action === "end_break") {
      if (!openShift) {
        throw new Error("No active shift. Clock in before ending a break.");
      }

      const [breakRows] = await conn.execute<AttendanceBreakRow[]>(
        `SELECT *
           FROM attendance_breaks
          WHERE shift_id = ?
            AND ended_at IS NULL
          ORDER BY started_at DESC
          LIMIT 1`,
        [openShift.shift_id]
      );

      const activeBreak = breakRows?.[0];
      if (!activeBreak) {
        throw new Error("No active break found.");
      }

      const breakDurationMinutes = minutesBetween(Number(activeBreak.started_at), now);
      await conn.execute(
        `UPDATE attendance_breaks
            SET ended_at = ?,
                duration_minutes = ?,
                updated_at = ?
          WHERE break_id = ?`,
        [now, breakDurationMinutes, now, activeBreak.break_id]
      );
    }

    if (action === "clock_out") {
      if (!openShift) {
        throw new Error("No active shift. Clock in first.");
      }

      const allBreaks = await getShiftBreaks(conn, openShift.shift_id);
      const activeBreak = allBreaks.find((br) => br.ended_at === null);
      if (activeBreak) {
        const activeDurationMinutes = minutesBetween(Number(activeBreak.started_at), now);
        await conn.execute(
          `UPDATE attendance_breaks
              SET ended_at = ?,
                  duration_minutes = ?,
                  updated_at = ?
            WHERE break_id = ?`,
          [now, activeDurationMinutes, now, activeBreak.break_id]
        );
      }

      const finalBreaks = await getShiftBreaks(conn, openShift.shift_id);
      const totalBreakMinutes = sumBreakMinutes(finalBreaks, now);
      const totalWorkMinutes = Math.max(
        0,
        minutesBetween(Number(openShift.clock_in_at), now) - totalBreakMinutes
      );

      await conn.execute(
        `UPDATE attendance_shifts
            SET clock_out_at = ?,
                total_work_minutes = ?,
                total_break_minutes = ?,
                note = COALESCE(?, note),
                updated_at = ?
          WHERE shift_id = ?`,
        [now, totalWorkMinutes, totalBreakMinutes, note, now, openShift.shift_id]
      );
    }

    await conn.commit();
    return await buildSnapshot(conn, employee, now);
  } catch (error) {
    try {
      await conn?.rollback();
    } catch {
      // Intentionally ignored to preserve original error.
    }
    throw error;
  } finally {
    await conn?.end();
  }
}

export async function getAdminAttendanceSnapshot(
  filters: AdminAttendanceFilters = {}
): Promise<AdminAttendanceSnapshot> {
  let conn: Awaited<ReturnType<typeof getConnection>> | undefined;
  const now = Date.now();
  const todayKey = dateKeyFromTimestamp(now);
  const weekCutoff = now - 6 * DAY_MS;
  const query = typeof filters.query === "string" ? filters.query.trim().slice(0, 120) : "";
  const status = filters.status ?? "all";
  const dateFrom = sanitizeDateInput(filters.dateFrom);
  const dateTo = sanitizeDateInput(filters.dateTo);
  const limit = Math.max(1, Math.min(100, Number(filters.limit) || 50));

  try {
    conn = await getConnection();
    await ensureAttendanceTables(conn);
    const db = conn;

    const [summaryRows] = await db.execute<
      Array<{ employees_tracked: number; active_employees: number; employees_on_break: number }>
    >(
      `SELECT
         COUNT(DISTINCT s.employee_user_id) AS employees_tracked,
         SUM(CASE WHEN s.clock_out_at IS NULL THEN 1 ELSE 0 END) AS active_employees,
         SUM(
           CASE
             WHEN s.clock_out_at IS NULL
              AND EXISTS (
                SELECT 1
                  FROM attendance_breaks b
                 WHERE b.shift_id = s.shift_id
                   AND b.ended_at IS NULL
              )
             THEN 1
             ELSE 0
           END
         ) AS employees_on_break
       FROM attendance_shifts s`
    );

    const [workRows] = await db.execute<AttendanceShiftRow[]>(
      `SELECT *
         FROM attendance_shifts
        WHERE shift_date = ?
           OR clock_out_at IS NULL
           OR clock_in_at >= ?
        ORDER BY clock_in_at DESC`,
      [todayKey, weekCutoff]
    );

    let todayWorkedMinutes = 0;
    let weekWorkedMinutes = 0;

    for (const shift of workRows || []) {
      let workedMinutes = Number(shift.total_work_minutes || 0);
      if (!shift.clock_out_at) {
        const breaks = await getShiftBreaks(db, shift.shift_id);
        workedMinutes = Math.max(
          0,
          minutesBetween(Number(shift.clock_in_at), now) - sumBreakMinutes(breaks, now)
        );
      }

      if (shift.shift_date === todayKey) {
        todayWorkedMinutes += workedMinutes;
      }
      if (Number(shift.clock_in_at || 0) >= weekCutoff) {
        weekWorkedMinutes += workedMinutes;
      }
    }

    const whereClauses = ["1 = 1"];
    const params: Array<string | number> = [];

    if (query) {
      whereClauses.push("(LOWER(s.employee_name) LIKE ? OR LOWER(s.employee_email) LIKE ?)");
      params.push(`%${query.toLowerCase()}%`, `%${query.toLowerCase()}%`);
    }
    if (dateFrom) {
      whereClauses.push("s.shift_date >= ?");
      params.push(dateFrom);
    }
    if (dateTo) {
      whereClauses.push("s.shift_date <= ?");
      params.push(dateTo);
    }
    if (status === "active") {
      whereClauses.push("s.clock_out_at IS NULL");
    } else if (status === "closed") {
      whereClauses.push("s.clock_out_at IS NOT NULL");
    } else if (status === "on_break") {
      whereClauses.push(
        `s.clock_out_at IS NULL
         AND EXISTS (
           SELECT 1
             FROM attendance_breaks bx
            WHERE bx.shift_id = s.shift_id
              AND bx.ended_at IS NULL
         )`
      );
    }

    const [recordRows] = await db.execute<AdminAttendanceShiftRow[]>(
      `SELECT
         s.*,
         CASE
           WHEN s.clock_out_at IS NULL
            AND EXISTS (
              SELECT 1
                FROM attendance_breaks b
               WHERE b.shift_id = s.shift_id
                 AND b.ended_at IS NULL
            )
           THEN 1
           ELSE 0
         END AS has_open_break
       FROM attendance_shifts s
      WHERE ${whereClauses.join(" AND ")}
      ORDER BY s.clock_in_at DESC
      LIMIT ?`,
      [...params, limit]
    );

    const [activeRows] = await db.execute<AdminAttendanceShiftRow[]>(
      `SELECT
         s.*,
         CASE
           WHEN EXISTS (
             SELECT 1
               FROM attendance_breaks b
              WHERE b.shift_id = s.shift_id
                AND b.ended_at IS NULL
           )
           THEN 1
           ELSE 0
         END AS has_open_break
       FROM attendance_shifts s
      WHERE s.clock_out_at IS NULL
      ORDER BY s.clock_in_at DESC
      LIMIT 10`
    );

    const summary = summaryRows?.[0] ?? {
      employees_tracked: 0,
      active_employees: 0,
      employees_on_break: 0};

    return {
      timezone: ATTENDANCE_TIMEZONE,
      generatedAt: now,
      summary: {
        employeesTracked: Number(summary.employees_tracked || 0),
        activeEmployees: Number(summary.active_employees || 0),
        employeesOnBreak: Number(summary.employees_on_break || 0),
        todayWorkedMinutes,
        weekWorkedMinutes},
      activeShifts: await Promise.all(
        (activeRows || []).map((row: AdminAttendanceShiftRow) =>
          toComputedAdminRecord(db, row, now, Boolean(row.has_open_break))
        )
      ),
      records: await Promise.all(
        (recordRows || []).map((row: AdminAttendanceShiftRow) =>
          toComputedAdminRecord(db, row, now, Boolean(row.has_open_break))
        )
      )};
  } finally {
    await conn?.end();
  }
}
