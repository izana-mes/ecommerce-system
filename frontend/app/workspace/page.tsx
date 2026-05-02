"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { getToken, getUser } from "@/lib/auth";
import "./workspace.css";

type Task = {
  id: number;
  task_key: string;
  title: string;
  description?: string | null;
  status: string;
  priority: string;
  assigned_to?: string | null;
  created_by: string;
  due_at?: string | null;
  created_at?: string | null;
};

type Note = {
  id: number;
  title: string;
  message: string;
  is_read: boolean;
  created_at?: string;
};

type Audit = {
  id: number;
  event_type: string;
  entity_type: string;
  entity_id: string;
  actor: string;
  created_at?: string;
};

function canUseWorkspace(role?: string): boolean {
  const r = String(role || "").toLowerCase();
  return r === "admin" || r === "employee" || r === "shipper" || r === "supplier";
}

export default function WorkspacePage() {
  const router = useRouter();
  const token = getToken();
  const user = getUser();

  const [tasks, setTasks] = useState<Task[]>([]);
  const [notifications, setNotifications] = useState<Note[]>([]);
  const [auditEvents, setAuditEvents] = useState<Audit[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [assignee, setAssignee] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const isAdmin = String(user?.role || "").toLowerCase() === "admin";

  useEffect(() => {
    if (!token || !user) {
      router.replace("/login");
      return;
    }
    if (!canUseWorkspace(user.role)) {
      router.replace("/");
      return;
    }

    const run = async () => {
      setLoading(true);
      await Promise.all([fetchTasks(), fetchNotifications(), ...(isAdmin ? [fetchAudit()] : [])]);
      setLoading(false);
    };

    void run();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, user?.role, isAdmin]);

  const fetchTasks = async () => {
    if (!token) return;
    try {
      const query = new URLSearchParams({ limit: "50" });
      if (statusFilter) query.set("status", statusFilter);
      const response = await fetch(`/api/workspace/tasks?${query.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.message || payload?.error || "Failed to load tasks");
      setTasks(Array.isArray(payload?.data) ? payload.data : []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load tasks");
    }
  };

  const fetchNotifications = async () => {
    if (!token) return;
    try {
      const response = await fetch("/api/workspace/notifications?limit=30", {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.message || payload?.error || "Failed to load notifications");
      setNotifications(Array.isArray(payload?.data) ? payload.data : []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load notifications");
    }
  };

  const fetchAudit = async () => {
    if (!token || !isAdmin) return;
    try {
      const response = await fetch("/api/workspace/audit-events?limit=20", {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.message || payload?.error || "Failed to load audit events");
      setAuditEvents(Array.isArray(payload?.data) ? payload.data : []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load audit events");
    }
  };

  const createTask = async (event: FormEvent) => {
    event.preventDefault();
    if (!token) return;
    setSaving(true);
    setError(null);
    try {
      const response = await fetch("/api/workspace/tasks", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          title,
          description,
          assigned_to: assignee || undefined,
          status: "OPEN",
          priority: "MEDIUM",
        }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.message || payload?.error || "Failed to create task");
      setTitle("");
      setDescription("");
      setAssignee("");
      await fetchTasks();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to create task");
    } finally {
      setSaving(false);
    }
  };

  const updateStatus = async (taskId: number, status: string) => {
    if (!token) return;
    try {
      const response = await fetch(`/api/workspace/tasks/${taskId}/status`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.message || payload?.error || "Failed to update task");
      await fetchTasks();
      await fetchNotifications();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to update task");
    }
  };

  const markRead = async (id: number) => {
    if (!token) return;
    const response = await fetch(`/api/workspace/notifications/${id}/read`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    if (response.ok) {
      await fetchNotifications();
    }
  };

  const exportReport = async (type: "workflow" | "notifications" | "audit") => {
    if (!token) return;
    const response = await fetch(`/api/workspace/reports/export?type=${type}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) {
      setError("Export failed");
      return;
    }
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${type}-report.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const unreadCount = useMemo(() => notifications.filter((n) => !n.is_read).length, [notifications]);

  if (loading) {
    return <main className="workspacePage"><p>Loading workspace...</p></main>;
  }

  return (
    <main className="workspacePage">
      <section className="workspaceHeader">
        <h1>Workspace Hub</h1>
        <p>Tasks, notifications, audit visibility, and report export in one place.</p>
      </section>

      {error ? <p className="workspaceError">{error}</p> : null}

      <section className="workspaceCard">
        <h2>Create Task</h2>
        <form className="workspaceForm" onSubmit={createTask}>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Task title" required />
          <input value={assignee} onChange={(e) => setAssignee(e.target.value)} placeholder="Assign to email (optional)" />
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Description" rows={3} />
          <button type="submit" disabled={saving}>{saving ? "Saving..." : "Create"}</button>
        </form>
      </section>

      <section className="workspaceCard">
        <div className="workspaceRow">
          <h2>My Tasks</h2>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">All statuses</option>
            <option value="OPEN">OPEN</option>
            <option value="IN_PROGRESS">IN_PROGRESS</option>
            <option value="DONE">DONE</option>
            <option value="ESCALATED">ESCALATED</option>
          </select>
          <button onClick={() => void fetchTasks()}>Refresh</button>
        </div>
        <div className="workspaceList">
          {tasks.map((task) => (
            <article key={task.id} className="workspaceItem">
              <div>
                <strong>{task.task_key}</strong> - {task.title}
                <p>{task.status} | {task.priority}</p>
              </div>
              <div className="workspaceActions">
                <button onClick={() => void updateStatus(task.id, "IN_PROGRESS")}>Start</button>
                <button onClick={() => void updateStatus(task.id, "DONE")}>Done</button>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="workspaceCard">
        <div className="workspaceRow">
          <h2>Notifications ({unreadCount} unread)</h2>
          <button onClick={() => void fetchNotifications()}>Refresh</button>
        </div>
        <div className="workspaceList">
          {notifications.map((note) => (
            <article key={note.id} className="workspaceItem">
              <div>
                <strong>{note.title}</strong>
                <p>{note.message}</p>
              </div>
              {!note.is_read ? <button onClick={() => void markRead(note.id)}>Mark read</button> : <span>Read</span>}
            </article>
          ))}
        </div>
      </section>

      {isAdmin ? (
        <section className="workspaceCard">
          <h2>Latest Audit Events</h2>
          <div className="workspaceList">
            {auditEvents.map((event) => (
              <article key={event.id} className="workspaceItem">
                <div>
                  <strong>{event.event_type}</strong>
                  <p>{event.entity_type} / {event.entity_id} / {event.actor}</p>
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      <section className="workspaceCard">
        <h2>Export Reports</h2>
        <div className="workspaceActions">
          <button onClick={() => void exportReport("workflow")}>Workflow CSV</button>
          <button onClick={() => void exportReport("notifications")}>Notifications CSV</button>
          {isAdmin ? <button onClick={() => void exportReport("audit")}>Audit CSV</button> : null}
        </div>
      </section>
    </main>
  );
}
