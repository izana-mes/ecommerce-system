"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { FiBell, FiCalendar, FiCheck, FiClock, FiMessageSquare, FiPlus, FiRefreshCw, FiUsers, FiX } from "react-icons/fi";
import { getUser } from "@/lib/auth";
import { createMeetingStompClient } from "@/lib/meetingSocket";
import "./meetings.css";

type CalendarView = "day" | "week" | "month" | "timeline";

type Participant = {
  participant_email: string;
  attendance_status: "ACCEPTED" | "DECLINED" | "MAYBE" | "PENDING";
  online_status?: string;
  is_late?: boolean;
};

type Meeting = {
  meeting_id: string;
  title: string;
  description?: string | null;
  start_at: string;
  end_at: string;
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  visibility: "PUBLIC" | "PRIVATE";
  status: string;
  meeting_room?: string | null;
  online_link?: string | null;
  related_type?: string | null;
  related_id?: string | null;
  notes?: string | null;
  created_by: string;
  participants?: Participant[];
  conflict_warnings?: string[];
  action_items?: Array<{ action_item_id: string; body: string; status: string; assigned_to?: string | null }>;
};

type Message = { message_id: string; sender_user_id: string; body: string; created_at: string };
type Comment = { comment_id: string; author_user_id: string; body: string; created_at: string };

const viewDays: Record<CalendarView, number> = { day: 1, week: 7, month: 35, timeline: 14 };
const hours = Array.from({ length: 13 }, (_, i) => i + 7);

function canUseMeetings(role?: string): boolean {
  return ["admin", "employee", "shipper", "supplier"].includes(String(role || "").toLowerCase());
}

function isoLocal(date: Date): string {
  const copy = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return copy.toISOString().slice(0, 16);
}

function startOfDay(date: Date): Date {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function addDays(date: Date, days: number): Date {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

function dateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function displayTime(value: string): string {
  return new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`/api/meetings${path}`, {
    credentials: "include",
    cache: "no-store",
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options,
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) throw new Error(payload?.message || payload?.error || "Meeting request failed");
  return payload?.data as T;
}

export default function MeetingsPage() {
  const router = useRouter();
  const user = getUser();
  const [view, setView] = useState<CalendarView>("week");
  const [anchor, setAnchor] = useState(() => startOfDay(new Date()));
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [selected, setSelected] = useState<Meeting | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [chatBody, setChatBody] = useState("");
  const [commentBody, setCommentBody] = useState("");
  const [actionBody, setActionBody] = useState("");

  const [form, setForm] = useState({
    title: "",
    description: "",
    startAt: isoLocal(new Date(Date.now() + 60 * 60 * 1000)),
    endAt: isoLocal(new Date(Date.now() + 2 * 60 * 60 * 1000)),
    participants: "",
    meetingRoom: "",
    onlineLink: "",
    relatedType: "",
    relatedId: "",
    notes: "",
    priority: "MEDIUM",
    visibility: "PUBLIC",
    repeatRule: "",
    repeatCount: "1",
    attachmentName: "",
    attachmentUrl: "",
  });

  const days = useMemo(() => Array.from({ length: viewDays[view] }, (_, i) => addDays(anchor, i)), [anchor, view]);
  const visibleRange = useMemo(() => {
    const from = anchor.toISOString();
    const to = addDays(anchor, viewDays[view]).toISOString();
    return { from, to };
  }, [anchor, view]);

  useEffect(() => {
    if (!user) {
      router.replace("/login");
      return;
    }
    if (!canUseMeetings(user.role)) {
      router.replace("/");
      return;
    }
    void loadMeetings();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.role, visibleRange.from, visibleRange.to, view]);

  useEffect(() => {
    if (!user?.email) return;
    const recipient = String(user.email).toLowerCase();
    const client = createMeetingStompClient((connected) => {
      connected.subscribe(`/topic/meetings/calendar/${recipient}`, () => void loadMeetings());
      connected.subscribe("/topic/meetings/team", () => void loadMeetings());
    });
    client.activate();
    return () => void client.deactivate();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.email, visibleRange.from, visibleRange.to]);

  const loadMeetings = async () => {
    try {
      setError(null);
      const query = new URLSearchParams({ from: visibleRange.from, to: visibleRange.to, view, team: "true" });
      const data = await api<Meeting[]>(`?${query}`);
      setMeetings(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load meetings");
    }
  };

  const openMeeting = async (meeting: Meeting) => {
    setSelected(meeting);
    try {
      const [full, chat, thread] = await Promise.all([
        api<Meeting>(`/${meeting.meeting_id}`),
        api<Message[]>(`/${meeting.meeting_id}/messages`),
        api<Comment[]>(`/${meeting.meeting_id}/comments`),
      ]);
      setSelected(full);
      setMessages(chat || []);
      setComments(thread || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to open meeting");
    }
  };

  const createMeeting = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const attachment = form.attachmentUrl.trim()
        ? [{ fileName: form.attachmentName || "Attachment", fileUrl: form.attachmentUrl }]
        : [];
      await api<Meeting>("", {
        method: "POST",
        body: JSON.stringify({
          title: form.title,
          description: form.description,
          startAt: new Date(form.startAt).toISOString(),
          endAt: new Date(form.endAt).toISOString(),
          participants: form.participants.split(",").map((email) => email.trim()).filter(Boolean),
          meetingRoom: form.meetingRoom,
          onlineLink: form.onlineLink,
          relatedType: form.relatedType,
          relatedId: form.relatedId,
          notes: form.notes,
          priority: form.priority,
          visibility: form.visibility,
          repeatRule: form.repeatRule || undefined,
          repeatCount: Number(form.repeatCount || 1),
          attachments: attachment,
        }),
      });
      setForm((current) => ({ ...current, title: "", description: "", notes: "", attachmentName: "", attachmentUrl: "" }));
      await loadMeetings();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create meeting");
    } finally {
      setSaving(false);
    }
  };

  const updateAttendance = async (status: string) => {
    if (!selected) return;
    const updated = await api<Meeting>(`/${selected.meeting_id}/attendance`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    });
    setSelected(updated);
    await loadMeetings();
  };

  const cancelMeeting = async () => {
    if (!selected) return;
    const updated = await api<Meeting>(`/${selected.meeting_id}/cancel`, { method: "PATCH", body: "{}" });
    setSelected(updated);
    await loadMeetings();
  };

  const sendChat = async (event: FormEvent) => {
    event.preventDefault();
    if (!selected || !chatBody.trim()) return;
    await api(`/${selected.meeting_id}/messages`, { method: "POST", body: JSON.stringify({ body: chatBody }) });
    setChatBody("");
    setMessages(await api<Message[]>(`/${selected.meeting_id}/messages`));
  };

  const sendComment = async (event: FormEvent) => {
    event.preventDefault();
    if (!selected || !commentBody.trim()) return;
    await api(`/${selected.meeting_id}/comments`, { method: "POST", body: JSON.stringify({ body: commentBody }) });
    setCommentBody("");
    setComments(await api<Comment[]>(`/${selected.meeting_id}/comments`));
  };

  const createActionItem = async (event: FormEvent) => {
    event.preventDefault();
    if (!selected || !actionBody.trim()) return;
    const assignedTo = actionBody.match(/@([^\s]+)/)?.[1];
    const updated = await api<Meeting>(`/${selected.meeting_id}/action-items`, {
      method: "POST",
      body: JSON.stringify({ body: actionBody, assignedTo }),
    });
    setActionBody("");
    await openMeeting({ ...selected, ...updated });
  };

  const rescheduleDrop = async (meeting: Meeting, day: Date, hour: number) => {
    const start = new Date(meeting.start_at);
    const end = new Date(meeting.end_at);
    const duration = end.getTime() - start.getTime();
    const nextStart = new Date(day);
    nextStart.setHours(hour, 0, 0, 0);
    const nextEnd = new Date(nextStart.getTime() + duration);
    try {
      await api<Meeting>(`/${meeting.meeting_id}/reschedule`, {
        method: "PATCH",
        body: JSON.stringify({ startAt: nextStart.toISOString(), endAt: nextEnd.toISOString() }),
      });
      await loadMeetings();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Reschedule failed");
    }
  };

  const meetingsByDay = useMemo(() => {
    const grouped = new Map<string, Meeting[]>();
    for (const meeting of meetings) {
      const key = dateKey(new Date(meeting.start_at));
      grouped.set(key, [...(grouped.get(key) || []), meeting]);
    }
    return grouped;
  }, [meetings]);

  return (
    <main className="meetingsPage">
      <section className="meetingsToolbar">
        <div>
          <h1><FiCalendar /> Team Calendar</h1>
          <p>Meetings, chat, notes, shifts, action items, and reminders share one schedule.</p>
        </div>
        <div className="meetingViewSwitch" role="tablist">
          {(["day", "week", "month", "timeline"] as CalendarView[]).map((mode) => (
            <button key={mode} className={view === mode ? "active" : ""} onClick={() => setView(mode)}>{mode}</button>
          ))}
        </div>
        <div className="meetingNav">
          <button onClick={() => setAnchor(addDays(anchor, -viewDays[view]))}>Prev</button>
          <button onClick={() => setAnchor(startOfDay(new Date()))}>Today</button>
          <button onClick={() => setAnchor(addDays(anchor, viewDays[view]))}>Next</button>
          <button aria-label="Refresh meetings" onClick={() => void loadMeetings()}><FiRefreshCw /></button>
        </div>
      </section>

      {error ? <p className="meetingError">{error}</p> : null}

      <section className="meetingLayout">
        <form className="meetingComposer" onSubmit={createMeeting}>
          <h2><FiPlus /> New Meeting</h2>
          <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Meeting title" required />
          <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Description" rows={3} />
          <div className="meetingTwo">
            <input type="datetime-local" value={form.startAt} onChange={(e) => setForm({ ...form, startAt: e.target.value })} required />
            <input type="datetime-local" value={form.endAt} onChange={(e) => setForm({ ...form, endAt: e.target.value })} required />
          </div>
          <input value={form.participants} onChange={(e) => setForm({ ...form, participants: e.target.value })} placeholder="Participants, comma-separated emails" />
          <div className="meetingTwo">
            <input value={form.meetingRoom} onChange={(e) => setForm({ ...form, meetingRoom: e.target.value })} placeholder="Room" />
            <input value={form.onlineLink} onChange={(e) => setForm({ ...form, onlineLink: e.target.value })} placeholder="Online link" />
          </div>
          <div className="meetingTwo">
            <select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
              <option>LOW</option><option>MEDIUM</option><option>HIGH</option><option>URGENT</option>
            </select>
            <select value={form.visibility} onChange={(e) => setForm({ ...form, visibility: e.target.value })}>
              <option>PUBLIC</option><option>PRIVATE</option>
            </select>
          </div>
          <div className="meetingTwo">
            <input value={form.relatedType} onChange={(e) => setForm({ ...form, relatedType: e.target.value })} placeholder="Related type" />
            <input value={form.relatedId} onChange={(e) => setForm({ ...form, relatedId: e.target.value })} placeholder="Related id" />
          </div>
          <div className="meetingTwo">
            <select value={form.repeatRule} onChange={(e) => setForm({ ...form, repeatRule: e.target.value })}>
              <option value="">No repeat</option><option>DAILY</option><option>WEEKLY</option><option>MONTHLY</option>
            </select>
            <input type="number" min="1" max="24" value={form.repeatCount} onChange={(e) => setForm({ ...form, repeatCount: e.target.value })} />
          </div>
          <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Shared notes with @mentions" rows={3} />
          <div className="meetingTwo">
            <input value={form.attachmentName} onChange={(e) => setForm({ ...form, attachmentName: e.target.value })} placeholder="Attachment name" />
            <input value={form.attachmentUrl} onChange={(e) => setForm({ ...form, attachmentUrl: e.target.value })} placeholder="Attachment URL" />
          </div>
          <button disabled={saving}>{saving ? "Saving..." : "Create meeting"}</button>
        </form>

        <section className={`calendarSurface ${view}`}>
          {view !== "timeline" ? (
            <div className="calendarGrid" style={{ gridTemplateColumns: `72px repeat(${days.length}, minmax(120px, 1fr))` }}>
              <div className="calendarCorner" />
              {days.map((day) => <div className="calendarDayHead" key={day.toISOString()}>{day.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}</div>)}
              {hours.map((hour) => (
                <div className="calendarRow" key={hour}>
                  <div className="calendarHour">{`${hour}:00`}</div>
                  {days.map((day) => (
                    <div
                      key={`${day.toISOString()}-${hour}`}
                      className="calendarCell"
                      onDragOver={(event) => event.preventDefault()}
                      onDrop={(event) => {
                        const meeting = meetings.find((item) => item.meeting_id === event.dataTransfer.getData("meeting-id"));
                        if (meeting) void rescheduleDrop(meeting, day, hour);
                      }}
                    >
                      {(meetingsByDay.get(dateKey(day)) || [])
                        .filter((meeting) => new Date(meeting.start_at).getHours() === hour)
                        .map((meeting) => (
                          <button
                            key={meeting.meeting_id}
                            draggable
                            onDragStart={(event) => event.dataTransfer.setData("meeting-id", meeting.meeting_id)}
                            className={`meetingBlock priority${meeting.priority}`}
                            onClick={() => void openMeeting(meeting)}
                          >
                            <strong>{meeting.title}</strong>
                            <span>{displayTime(meeting.start_at)} - {displayTime(meeting.end_at)}</span>
                          </button>
                        ))}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          ) : (
            <div className="timelineList">
              {meetings.map((meeting) => (
                <button key={meeting.meeting_id} className={`timelineItem priority${meeting.priority}`} onClick={() => void openMeeting(meeting)}>
                  <span>{new Date(meeting.start_at).toLocaleDateString()} {displayTime(meeting.start_at)}</span>
                  <strong>{meeting.title}</strong>
                  <small>{meeting.meeting_room || meeting.online_link || "No location"}</small>
                </button>
              ))}
            </div>
          )}
        </section>
      </section>

      {selected ? (
        <aside className="meetingDrawer">
          <div className="drawerHeader">
            <div>
              <h2>{selected.title}</h2>
              <p><FiClock /> {displayTime(selected.start_at)} - {displayTime(selected.end_at)}</p>
            </div>
            <button aria-label="Close meeting" onClick={() => setSelected(null)}><FiX /></button>
          </div>
          <div className="drawerActions">
            <button onClick={() => void updateAttendance("ACCEPTED")}><FiCheck /> Accept</button>
            <button onClick={() => void updateAttendance("MAYBE")}>Maybe</button>
            <button onClick={() => void updateAttendance("DECLINED")}>Decline</button>
            <button className="danger" onClick={() => void cancelMeeting()}>Cancel</button>
          </div>
          {(selected.conflict_warnings || []).map((warning) => <p className="meetingWarn" key={warning}><FiBell /> {warning}</p>)}
          <section>
            <h3><FiUsers /> Participants</h3>
            <div className="participantList">
              {(selected.participants || []).map((participant) => (
                <span key={participant.participant_email}>{participant.participant_email} · {participant.attendance_status}</span>
              ))}
            </div>
          </section>
          <section>
            <h3><FiMessageSquare /> Meeting Chat</h3>
            <div className="threadBox">
              {messages.map((message) => <p key={message.message_id}><strong>{message.sender_user_id}</strong> {message.body}</p>)}
            </div>
            <form className="inlineComposer" onSubmit={sendChat}>
              <input value={chatBody} onChange={(e) => setChatBody(e.target.value)} placeholder="@employee_a please complete this before tomorrow." />
              <button>Send</button>
            </form>
          </section>
          <section>
            <h3>Notes & Comments</h3>
            <p className="meetingNotes">{selected.notes || "No shared notes yet."}</p>
            <div className="threadBox">
              {comments.map((comment) => <p key={comment.comment_id}><strong>{comment.author_user_id}</strong> {comment.body}</p>)}
            </div>
            <form className="inlineComposer" onSubmit={sendComment}>
              <input value={commentBody} onChange={(e) => setCommentBody(e.target.value)} placeholder="Add a comment with @mentions" />
              <button>Post</button>
            </form>
          </section>
          <section>
            <h3>Action Items</h3>
            <div className="actionList">
              {(selected.action_items || []).map((item) => <span key={item.action_item_id}>{item.body} · {item.status}</span>)}
            </div>
            <form className="inlineComposer" onSubmit={createActionItem}>
              <input value={actionBody} onChange={(e) => setActionBody(e.target.value)} placeholder="@employee_a follow up" />
              <button>Add</button>
            </form>
          </section>
        </aside>
      ) : null}
    </main>
  );
}
