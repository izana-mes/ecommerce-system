"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { API_BASE_URL } from "@/lib/api";
import "./shifts.css";

type ShiftStatus = "PENDING" | "ACCEPTED" | "REJECTED" | "COMPLETED" | "ABSENT" | "SWAPPED";
type ShiftRole = "EMPLOYEE" | "SHIPPER";

type Shift = {
  id: string;
  assigneeCode: string;
  assigneeName: string;
  assigneeEmail: string;
  role: ShiftRole;
  shiftDate: string;
  startAt: string;
  endAt: string;
  timezone: string;
  location: string;
  note?: string;
  status: ShiftStatus;
  durationHours: number;
  warnings: string[];
};

type ScheduleResponse = {
  timezone: string;
  totalHours: number;
  warnings: string[];
  shifts: Shift[];
};

type ImportRow = {
  rowNumber: number;
  employeeCode: string;
  role: string;
  shiftDate: string;
  startTime: string;
  endTime: string;
  location: string;
  note: string;
  errors: string[];
  warnings: string[];
};

type ImportPreview = {
  fileName: string;
  totalRows: number;
  validRows: number;
  invalidRows: number;
  rows: ImportRow[];
};

const statuses: Array<ShiftStatus | ""> = ["", "PENDING", "ACCEPTED", "COMPLETED", "ABSENT", "SWAPPED", "REJECTED"];

function today() {
  return new Date().toISOString().slice(0, 10);
}

function addDays(date: string, days: number) {
  const value = new Date(`${date}T00:00:00`);
  value.setDate(value.getDate() + days);
  return value.toISOString().slice(0, 10);
}

function time(value: string) {
  return new Date(value).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export default function AdminShiftsPage() {
  const [from, setFrom] = useState(today());
  const [to, setTo] = useState(addDays(today(), 6));
  const [status, setStatus] = useState<ShiftStatus | "">("");
  const [timezone, setTimezone] = useState("Asia/Ho_Chi_Minh");
  const [schedule, setSchedule] = useState<ScheduleResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [form, setForm] = useState({
    assigneeCode: "EMP001",
    role: "EMPLOYEE" as ShiftRole,
    shiftDate: today(),
    startTime: "08:00",
    endTime: "17:00",
    location: "Hanoi",
    note: ""});

  const loadSchedule = useCallback(async () => {
    setLoading(true);
    setMessage("");
    try {
      const params = new URLSearchParams({ from, to, timezone });
      if (status) params.set("status", status);
      const response = await fetch(`${API_BASE_URL}/api/admin/shifts?${params.toString()}`, {
        credentials: "include",
        cache: "no-store"});
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || payload.message || "Failed to load shifts.");
      setSchedule(payload);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to load shifts.");
    } finally {
      setLoading(false);
    }
  }, [from, to, status, timezone]);

  useEffect(() => {
    void loadSchedule();
  }, [loadSchedule]);

  const grouped = useMemo(() => {
    const groups = new Map<string, Shift[]>();
    for (const shift of schedule?.shifts ?? []) {
      groups.set(shift.shiftDate, [...(groups.get(shift.shiftDate) ?? []), shift]);
    }
    return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [schedule]);

  async function submitShift(event: FormEvent) {
    event.preventDefault();
    setMessage("");
    const response = await fetch(`${API_BASE_URL}/api/admin/shifts`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, timezone })});
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      setMessage(payload.error || payload.message || "Could not create shift.");
      return;
    }
    setMessage("Shift created.");
    await loadSchedule();
  }

  async function deleteShift(id: string) {
    const response = await fetch(`${API_BASE_URL}/api/admin/shifts/${id}`, {
      method: "DELETE",
      credentials: "include"});
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      setMessage(payload.error || payload.message || "Could not delete shift.");
      return;
    }
    await loadSchedule();
  }

  async function previewImport() {
    if (!file) return;
    const data = new FormData();
    data.append("file", file);
    const response = await fetch(`${API_BASE_URL}/api/admin/shifts/import/preview?timezone=${encodeURIComponent(timezone)}`, {
      method: "POST",
      credentials: "include",
      body: data});
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      setMessage(payload.error || payload.message || "Import preview failed.");
      return;
    }
    setPreview(payload);
  }

  async function executeImport() {
    if (!file) return;
    const data = new FormData();
    data.append("file", file);
    const response = await fetch(`${API_BASE_URL}/api/admin/shifts/import?timezone=${encodeURIComponent(timezone)}`, {
      method: "POST",
      credentials: "include",
      body: data});
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      setMessage(payload.error || payload.message || "Import failed and was rolled back.");
      return;
    }
    setMessage(`Imported ${payload.importedRows} shifts.`);
    setPreview(null);
    await loadSchedule();
  }

  return (
    <main className="shift-admin jp-seigaiha-bg">
      <section className="shift-toolbar">
        <div>
          <h1>Shift Management</h1>
          <p>Schedule employees and shippers, validate imports, and monitor staffing warnings.</p>
        </div>
        <div className="shift-kpis">
          <span>{schedule?.shifts.length ?? 0} shifts</span>
          <span>{schedule?.totalHours ?? 0} hours</span>
          <span>{schedule?.warnings.length ?? 0} warnings</span>
        </div>
      </section>

      <section className="shift-filters">
        <label>From<input type="date" value={from} onChange={(event) => setFrom(event.target.value)} /></label>
        <label>To<input type="date" value={to} onChange={(event) => setTo(event.target.value)} /></label>
        <label>Status<select value={status} onChange={(event) => setStatus(event.target.value as ShiftStatus | "")}>
          {statuses.map((item) => <option key={item || "ALL"} value={item}>{item || "All statuses"}</option>)}
        </select></label>
        <label>Timezone<input value={timezone} onChange={(event) => setTimezone(event.target.value)} /></label>
        <button onClick={loadSchedule} disabled={loading}>{loading ? "Loading" : "Refresh"}</button>
      </section>

      {message && <div className="shift-message">{message}</div>}
      {!!schedule?.warnings.length && <div className="shift-warning">{schedule.warnings.join(" · ")}</div>}

      <div className="shift-grid">
        <section className="shift-panel">
          <h2>Create Shift</h2>
          <form onSubmit={submitShift} className="shift-form">
            <input placeholder="EMP001 or SHP002" value={form.assigneeCode} onChange={(event) => setForm({ ...form, assigneeCode: event.target.value })} />
            <select value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value as ShiftRole })}>
              <option value="EMPLOYEE">Employee</option>
              <option value="SHIPPER">Shipper</option>
            </select>
            <input type="date" value={form.shiftDate} onChange={(event) => setForm({ ...form, shiftDate: event.target.value })} />
            <div className="shift-form-row">
              <input type="time" value={form.startTime} onChange={(event) => setForm({ ...form, startTime: event.target.value })} />
              <input type="time" value={form.endTime} onChange={(event) => setForm({ ...form, endTime: event.target.value })} />
            </div>
            <input placeholder="Location" value={form.location} onChange={(event) => setForm({ ...form, location: event.target.value })} />
            <textarea placeholder="Note" value={form.note} onChange={(event) => setForm({ ...form, note: event.target.value })} />
            <button type="submit">Create shift</button>
          </form>
        </section>

        <section className="shift-panel">
          <h2>CSV / Excel Import</h2>
          <p className="shift-muted">Columns: employee_code, role, shift_date, start_time, end_time, location, note</p>
          <input type="file" accept=".csv,.xlsx" onChange={(event) => setFile(event.target.files?.[0] ?? null)} />
          <div className="shift-form-row">
            <button onClick={previewImport} disabled={!file}>Preview</button>
            <button onClick={executeImport} disabled={!file || !!preview?.invalidRows}>Import</button>
          </div>
          {preview && (
            <div className="shift-preview">
              <strong>{preview.validRows} valid / {preview.invalidRows} invalid</strong>
              <div className="shift-preview-table">
                {preview.rows.slice(0, 20).map((row) => (
                  <div key={row.rowNumber} className={row.errors.length ? "invalid" : ""}>
                    <span>Row {row.rowNumber}: {row.employeeCode} {row.shiftDate} {row.startTime}-{row.endTime}</span>
                    <small>{row.errors.join(", ") || row.warnings.join(", ") || "Ready"}</small>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      </div>

      <section className="shift-schedule">
        {grouped.map(([date, shifts]) => (
          <div className="shift-day" key={date}>
            <h2>{date}</h2>
            {shifts.map((shift) => (
              <article className="shift-item" key={shift.id}>
                <div>
                  <strong>{time(shift.startAt)} - {time(shift.endAt)}</strong>
                  <span>{shift.assigneeCode} · {shift.assigneeName} · {shift.role.toLowerCase()}</span>
                  <small>{shift.location} · {shift.durationHours}h {shift.note ? `· ${shift.note}` : ""}</small>
                  {!!shift.warnings.length && <small className="warn">{shift.warnings.join(", ")}</small>}
                </div>
                <div className="shift-actions">
                  <span className={`status ${shift.status.toLowerCase()}`}>{shift.status.toLowerCase()}</span>
                  <button onClick={() => deleteShift(shift.id)}>Delete</button>
                </div>
              </article>
            ))}
          </div>
        ))}
      </section>
    </main>
  );
}
