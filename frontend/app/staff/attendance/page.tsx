"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { getToken, getUser } from "@/lib/auth";
import "./attendance.css";

type AttendanceAction = "clock_in" | "clock_out" | "start_break" | "end_break";
type ReviewStatus = "OPEN" | "ACKNOWLEDGED" | "RESOLVED";
type ReviewStatusFilter = "ALL" | ReviewStatus;

type AttendanceSnapshot = {
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
  openShift: {
    shiftId: string;
    clockInAt: number;
    shiftDate: string;
  } | null;
  liveWorkedMinutes: number;
  liveBreakMinutes: number;
  todayTotalMinutes: number;
  weekTotalMinutes: number;
  latestAction: {
    actionLogId: string;
    shiftId: string | null;
    actionType: string;
    note: string | null;
    locationLabel: string | null;
    latitude: number;
    longitude: number;
    accuracyMeters: number | null;
    clientRecordedAt: number | null;
    recordedAt: number;
  } | null;
  recentActions: Array<{
    actionLogId: string;
    shiftId: string | null;
    actionType: string;
    note: string | null;
    locationLabel: string | null;
    latitude: number;
    longitude: number;
    accuracyMeters: number | null;
    clientRecordedAt: number | null;
    recordedAt: number;
  }>;
  recentShifts: Array<{
    shiftId: string;
    shiftDate: string;
    clockInAt: number;
    clockOutAt: number | null;
    totalWorkMinutes: number;
    totalBreakMinutes: number;
    status: "open" | "closed";
    note: string | null;
  }>;
};

type EmployeePerformanceReview = {
  reviewId: string;
  reviewType: string;
  category: string;
  title: string;
  summary: string;
  status: ReviewStatus;
  relatedShiftId: string | null;
  lastNotifiedAt: number | null;
  notificationCount: number;
  createdBy: string;
  createdAt: number;
  updatedAt: number;
};

type EmployeePerformanceReviewsResponse = {
  employeeUserId: string;
  employeeEmail: string;
  generatedAt: number;
  summary: {
    totalReviews: number;
    openReviews: number;
    acknowledgedReviews: number;
    resolvedReviews: number;
  };
  reviews: EmployeePerformanceReview[];
  error?: string;
};

function formatDuration(totalMinutes: number): string {
  const safe = Math.max(0, Math.floor(totalMinutes));
  const hours = Math.floor(safe / 60);
  const minutes = safe % 60;
  return `${hours}h ${minutes}m`;
}

function formatDateTime(value: number | null): string {
  if (!value) return "-";
  return new Date(value).toLocaleString();
}

function formatReviewType(value: string): string {
  return value.toLowerCase().replaceAll("_", " ");
}

function formatReviewCategory(value: string): string {
  return value.toLowerCase().replaceAll("_", " ");
}

function formatActionType(value: string): string {
  return value.toLowerCase().replaceAll("_", " ");
}

export default function StaffAttendancePage() {
  const router = useRouter();
  const [loadingAccess, setLoadingAccess] = useState(true);
  const [allowed, setAllowed] = useState(false);
  const [snapshot, setSnapshot] = useState<AttendanceSnapshot | null>(null);
  const [reviews, setReviews] = useState<EmployeePerformanceReview[]>([]);
  const [reviewSummary, setReviewSummary] = useState<EmployeePerformanceReviewsResponse["summary"] | null>(null);
  const [reviewFilter, setReviewFilter] = useState<ReviewStatusFilter>("ALL");
  const [loadingSnapshot, setLoadingSnapshot] = useState(false);
  const [loadingReviews, setLoadingReviews] = useState(false);
  const [runningAction, setRunningAction] = useState<AttendanceAction | "">("");
  const [reviewUpdateId, setReviewUpdateId] = useState<string>("");
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [tick, setTick] = useState(Date.now());

  const token = getToken();

  const fetchSnapshot = useCallback(async () => {
    setLoadingSnapshot(true);
    try {
      const response = await fetch("/api/attendance", {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        cache: "no-store",
      });

      const payload = (await response.json().catch(() => ({}))) as AttendanceSnapshot & { error?: string };
      if (!response.ok) {
        throw new Error(payload.error || `Failed to load attendance (${response.status}).`);
      }

      setSnapshot(payload);
      setError("");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load attendance.");
    } finally {
      setLoadingSnapshot(false);
    }
  }, [token]);

  const fetchReviews = useCallback(async (statusFilter: ReviewStatusFilter) => {
    setLoadingReviews(true);
    try {
      const query = statusFilter === "ALL" ? "" : `?status=${encodeURIComponent(statusFilter)}`;
      const response = await fetch(`/api/attendance/reviews${query}`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        cache: "no-store",
      });

      const payload = (await response.json().catch(() => ({}))) as EmployeePerformanceReviewsResponse;
      if (!response.ok) {
        throw new Error(payload.error || `Failed to load reviews (${response.status}).`);
      }

      setReviews(Array.isArray(payload.reviews) ? payload.reviews : []);
      setReviewSummary(payload.summary || null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load performance reviews.");
      setReviews([]);
      setReviewSummary(null);
    } finally {
      setLoadingReviews(false);
    }
  }, [token]);

  useEffect(() => {
    const checkAccess = async () => {
      const user = getUser();
      if (!user || !token) {
        router.replace("/login");
        return;
      }

      try {
        const response = await fetch("/api/auth/me", {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          cache: "no-store",
        });

        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          setAllowed(false);
          return;
        }

        const profile = data?.data;
        const role = String(profile?.role || "").toLowerCase();
        const roles = Array.isArray(profile?.roles)
          ? profile.roles.map((value: string) => String(value).toUpperCase())
          : [];

        const isAllowed =
          role === "employee" ||
          role === "admin" ||
          roles.includes("ROLE_EMPLOYEE") ||
          roles.includes("ROLE_ADMIN") ||
          roles.includes("ROLE_STAFF");

        setAllowed(isAllowed);
      } catch {
        setAllowed(false);
      } finally {
        setLoadingAccess(false);
      }
    };

    void checkAccess();
  }, [router, token]);

  useEffect(() => {
    if (!allowed) return;
    void fetchSnapshot();
    void fetchReviews(reviewFilter);

    const interval = window.setInterval(() => {
      void fetchSnapshot();
      void fetchReviews(reviewFilter);
    }, 20_000);

    return () => window.clearInterval(interval);
  }, [allowed, fetchReviews, fetchSnapshot, reviewFilter]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setTick(Date.now());
    }, 1_000);

    return () => window.clearInterval(interval);
  }, []);

  const dynamicWorkedMinutes = useMemo(() => {
    if (!snapshot) return 0;

    if (snapshot.status === "CLOCKED_IN" && !snapshot.onBreak) {
      const elapsed = Math.floor((tick - snapshot.generatedAt) / 60_000);
      return Math.max(snapshot.liveWorkedMinutes, snapshot.liveWorkedMinutes + elapsed);
    }

    return snapshot.liveWorkedMinutes;
  }, [snapshot, tick]);

  const elapsedSinceSnapshotMinutes = useMemo(() => {
    if (!snapshot || snapshot.status !== "CLOCKED_IN") return 0;
    return Math.max(0, Math.floor((tick - snapshot.generatedAt) / 60_000));
  }, [snapshot, tick]);

  const dynamicBreakMinutes = useMemo(() => {
    if (!snapshot) return 0;
    if (!snapshot.onBreak) return snapshot.liveBreakMinutes;
    return Math.max(snapshot.liveBreakMinutes, snapshot.liveBreakMinutes + elapsedSinceSnapshotMinutes);
  }, [elapsedSinceSnapshotMinutes, snapshot]);

  const dynamicTodayTotalMinutes = useMemo(() => {
    if (!snapshot || snapshot.status !== "CLOCKED_IN" || snapshot.onBreak) {
      return snapshot?.todayTotalMinutes ?? 0;
    }

    return Math.max(
      snapshot.todayTotalMinutes,
      snapshot.todayTotalMinutes + elapsedSinceSnapshotMinutes
    );
  }, [elapsedSinceSnapshotMinutes, snapshot]);

  const dynamicWeekTotalMinutes = useMemo(() => {
    if (!snapshot || snapshot.status !== "CLOCKED_IN" || snapshot.onBreak) {
      return snapshot?.weekTotalMinutes ?? 0;
    }

    return Math.max(snapshot.weekTotalMinutes, snapshot.weekTotalMinutes + elapsedSinceSnapshotMinutes);
  }, [elapsedSinceSnapshotMinutes, snapshot]);

  const attendanceCompletion = useMemo(() => {
    const minutes = dynamicTodayTotalMinutes;
    return Math.min(100, Math.max(0, Math.round((minutes / 480) * 100)));
  }, [dynamicTodayTotalMinutes]);

  const captureAttendanceLocation = useCallback(async () => {
    if (typeof window === "undefined" || !("geolocation" in navigator)) {
      throw new Error("This device does not support location detection.");
    }

    const position = await new Promise<GeolocationPosition>((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: true,
        timeout: 15_000,
        maximumAge: 0,
      });
    });

    const latitude = Number(position.coords.latitude);
    const longitude = Number(position.coords.longitude);
    const accuracyMeters = Number.isFinite(position.coords.accuracy)
      ? Math.round(position.coords.accuracy)
      : null;
    const capturedAt = Date.now();

    let label = `GPS ${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
    try {
      const reverseResponse = await fetch(
        `/api/location/reverse?lat=${encodeURIComponent(String(latitude))}&lon=${encodeURIComponent(
          String(longitude)
        )}`,
        { cache: "no-store" }
      );
      const reversePayload = await reverseResponse.json().catch(() => ({}));
      if (reverseResponse.ok) {
        const displayName = String(reversePayload?.displayName || "").trim();
        const streetAddress1 = String(reversePayload?.streetAddress1 || "").trim();
        label = displayName || streetAddress1 || label;
      }
    } catch {
      // Ignore reverse geocoding errors; GPS coordinates are sufficient.
    }

    return { latitude, longitude, accuracyMeters, capturedAt, label };
  }, []);

  const runAction = async (action: AttendanceAction) => {
    setRunningAction(action);
    try {
      const location = await captureAttendanceLocation();
      const response = await fetch("/api/attendance", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ action, note, location }),
      });

      const payload = (await response.json().catch(() => ({}))) as AttendanceSnapshot & { error?: string };
      if (!response.ok) {
        throw new Error(payload.error || `Action failed (${response.status}).`);
      }

      setSnapshot(payload);
      setError("");
      if (action === "clock_in" || action === "clock_out") {
        setNote("");
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Attendance action failed.");
    } finally {
      setRunningAction("");
    }
  };

  const updateReviewStatus = async (reviewId: string, status: ReviewStatus) => {
    setReviewUpdateId(reviewId);
    try {
      const response = await fetch(`/api/attendance/reviews/${encodeURIComponent(reviewId)}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ status }),
      });
      const payload = (await response.json().catch(() => ({}))) as EmployeePerformanceReview & { error?: string };
      if (!response.ok) {
        throw new Error(payload.error || `Failed to update review (${response.status}).`);
      }

      setReviews((current) => current.map((review) => (review.reviewId === reviewId ? payload : review)));
      setReviewSummary((current) => {
        if (!current) return current;
        const nextReviews = reviews.map((review) => (review.reviewId === reviewId ? payload : review));
        return {
          totalReviews: nextReviews.length,
          openReviews: nextReviews.filter((review) => review.status === "OPEN").length,
          acknowledgedReviews: nextReviews.filter((review) => review.status === "ACKNOWLEDGED").length,
          resolvedReviews: nextReviews.filter((review) => review.status === "RESOLVED").length,
        };
      });
      setError("");
      await fetchReviews(reviewFilter);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to update performance review.");
    } finally {
      setReviewUpdateId("");
    }
  };

  const handleSubmitNote = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
  };

  if (loadingAccess) {
    return (
      <section className="attendancePage">
        <div className="attendanceCard">
          <h1>Employee Attendance</h1>
          <p>Checking access...</p>
        </div>
      </section>
    );
  }

  if (!allowed) {
    return (
      <section className="attendancePage">
        <div className="attendanceCard">
          <h1>Employee Attendance</h1>
          <p>You need employee or admin permissions to access this page.</p>
        </div>
      </section>
    );
  }

  return (
    <section className="attendancePage">
      <div className="attendanceCard">
        <header className="attendanceHeader">
          <h1>Employee Attendance</h1>
          <p>Track working time, monitor progress, and handle review follow-ups from one page.</p>
        </header>

        <div className="attendanceMetaGrid">
          <article>
            <h2>Employee</h2>
            <p>{snapshot?.employee.name || getUser()?.email || "-"}</p>
          </article>
          <article>
            <h2>Role</h2>
            <p>{snapshot?.employee.role || getUser()?.role || "-"}</p>
          </article>
          <article>
            <h2>Timezone</h2>
            <p>{snapshot?.timezone || "UTC"}</p>
          </article>
          <article>
            <h2>Last Sync</h2>
            <p>{formatDateTime(snapshot?.generatedAt ?? null)}</p>
          </article>
        </div>

        {error ? <p className="attendanceError">{error}</p> : null}

        <div className="attendanceStatusGrid">
          <article>
            <h2>Status</h2>
            <p className={`attendanceBadge ${snapshot?.status === "CLOCKED_IN" ? "in" : "out"}`}>
              {snapshot?.status === "CLOCKED_IN" ? (snapshot?.onBreak ? "On Break" : "Clocked In") : "Clocked Out"}
            </p>
          </article>

          <article>
            <h2>Live Worked Time</h2>
            <p>{formatDuration(dynamicWorkedMinutes)}</p>
          </article>

          <article>
            <h2>Break Time</h2>
            <p>{formatDuration(dynamicBreakMinutes)}</p>
          </article>

          <article>
            <h2>Today Total</h2>
            <p>{formatDuration(dynamicTodayTotalMinutes)}</p>
          </article>

          <article>
            <h2>Last 7 Days</h2>
            <p>{formatDuration(dynamicWeekTotalMinutes)}</p>
          </article>

          <article>
            <h2>Daily Goal</h2>
            <p>{attendanceCompletion}% of 8h</p>
          </article>
        </div>

        <section className="attendanceInsights">
          <article>
            <h2>Open Shift Since</h2>
            <p>{formatDateTime(snapshot?.openShift?.clockInAt ?? null)}</p>
          </article>
          <article>
            <h2>Open Reviews</h2>
            <p>{reviewSummary?.openReviews ?? 0}</p>
          </article>
          <article>
            <h2>Acknowledged Reviews</h2>
            <p>{reviewSummary?.acknowledgedReviews ?? 0}</p>
          </article>
          <article>
            <h2>Resolved Reviews</h2>
            <p>{reviewSummary?.resolvedReviews ?? 0}</p>
          </article>
        </section>

        <section className="attendanceLocationPanel">
          <article>
            <h2>Latest Location Stamp</h2>
            <p>{snapshot?.latestAction?.locationLabel || "No location recorded yet"}</p>
            <span>
              {snapshot?.latestAction
                ? `${snapshot.latestAction.latitude.toFixed(5)}, ${snapshot.latestAction.longitude.toFixed(5)}`
                : "-"}
            </span>
          </article>
          <article>
            <h2>Latest Action Time</h2>
            <p>{formatDateTime(snapshot?.latestAction?.recordedAt ?? null)}</p>
            <span>
              {snapshot?.latestAction?.accuracyMeters
                ? `Accuracy ±${snapshot.latestAction.accuracyMeters}m`
                : "Accuracy unavailable"}
            </span>
          </article>
        </section>

        <form className="attendanceNoteForm" onSubmit={handleSubmitNote}>
          <label htmlFor="attendance-note">Optional note for clock in/out</label>
          <p className="attendanceLocationHint">
            Live device location is required for every attendance action and is recorded with the server timestamp.
          </p>
          <textarea
            id="attendance-note"
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Example: Supporting checkout hotline in shift A"
            rows={2}
            maxLength={400}
          />
        </form>

        <div className="attendanceActionRow">
          <button
            type="button"
            className="primary"
            onClick={() => void runAction("clock_in")}
            disabled={runningAction !== "" || snapshot?.status === "CLOCKED_IN"}
          >
            {runningAction === "clock_in" ? "Clocking In..." : "Clock In"}
          </button>

          <button
            type="button"
            onClick={() => void runAction("start_break")}
            disabled={
              runningAction !== "" ||
              snapshot?.status !== "CLOCKED_IN" ||
              Boolean(snapshot?.onBreak)
            }
          >
            {runningAction === "start_break" ? "Starting..." : "Start Break"}
          </button>

          <button
            type="button"
            onClick={() => void runAction("end_break")}
            disabled={runningAction !== "" || !snapshot?.onBreak}
          >
            {runningAction === "end_break" ? "Ending..." : "End Break"}
          </button>

          <button
            type="button"
            className="danger"
            onClick={() => void runAction("clock_out")}
            disabled={runningAction !== "" || snapshot?.status !== "CLOCKED_IN"}
          >
            {runningAction === "clock_out" ? "Clocking Out..." : "Clock Out"}
          </button>
        </div>

        <section className="attendanceHistory">
          <div className="attendanceHistoryHead">
            <h2>Recent Location Logs</h2>
          </div>

          <div className="attendanceReviewGrid">
            {(snapshot?.recentActions || []).length === 0 ? (
              <p className="attendanceReviewEmpty">No action logs yet.</p>
            ) : (
              (snapshot?.recentActions || []).map((action) => (
                <article key={action.actionLogId} className="attendanceReviewCard">
                  <div className="attendanceReviewHead">
                    <div>
                      <h3>{formatActionType(action.actionType)}</h3>
                      <p>{action.locationLabel || "Device GPS capture"}</p>
                    </div>
                    <span className="attendanceReviewBadge status-open">
                      {formatDateTime(action.recordedAt)}
                    </span>
                  </div>
                  <p className="attendanceReviewSummary">
                    {action.latitude.toFixed(5)}, {action.longitude.toFixed(5)}
                  </p>
                  <div className="attendanceReviewMeta">
                    <span>{action.accuracyMeters ? `Accuracy ±${action.accuracyMeters}m` : "Accuracy unavailable"}</span>
                    <span>{action.note || "No note"}</span>
                  </div>
                </article>
              ))
            )}
          </div>
        </section>

        <section className="attendanceHistory">
          <div className="attendanceHistoryHead">
            <h2>Performance Reviews</h2>
            <div className="attendanceHistoryControls">
              <select
                value={reviewFilter}
                onChange={(event) => setReviewFilter(event.target.value as ReviewStatusFilter)}
              >
                <option value="ALL">All reviews</option>
                <option value="OPEN">Open</option>
                <option value="ACKNOWLEDGED">Acknowledged</option>
                <option value="RESOLVED">Resolved</option>
              </select>
              <button
                type="button"
                className="ghost"
                onClick={() => void fetchReviews(reviewFilter)}
                disabled={loadingReviews}
              >
                {loadingReviews ? "Refreshing..." : "Refresh"}
              </button>
            </div>
          </div>

          <div className="attendanceReviewGrid">
            {reviews.length === 0 ? (
              <p className="attendanceReviewEmpty">
                {loadingReviews ? "Loading reviews..." : "No reviews in this view."}
              </p>
            ) : (
              reviews.map((review) => (
                <article key={review.reviewId} className="attendanceReviewCard">
                  <div className="attendanceReviewHead">
                    <div>
                      <h3>{review.title}</h3>
                      <p>
                        {formatReviewType(review.reviewType)} · {formatReviewCategory(review.category)}
                      </p>
                    </div>
                    <span className={`attendanceReviewBadge status-${review.status.toLowerCase()}`}>
                      {review.status}
                    </span>
                  </div>
                  <p className="attendanceReviewSummary">{review.summary}</p>
                  <div className="attendanceReviewMeta">
                    <span>Created by {review.createdBy}</span>
                    <span>{formatDateTime(review.createdAt)}</span>
                    <span>Notifications: {review.notificationCount}</span>
                  </div>
                  <div className="attendanceReviewActions">
                    <button
                      type="button"
                      onClick={() => void updateReviewStatus(review.reviewId, "ACKNOWLEDGED")}
                      disabled={reviewUpdateId === review.reviewId || review.status === "ACKNOWLEDGED" || review.status === "RESOLVED"}
                    >
                      {reviewUpdateId === review.reviewId ? "Saving..." : "Acknowledge"}
                    </button>
                    <button
                      type="button"
                      onClick={() => void updateReviewStatus(review.reviewId, "RESOLVED")}
                      disabled={reviewUpdateId === review.reviewId || review.status === "RESOLVED"}
                    >
                      {reviewUpdateId === review.reviewId ? "Saving..." : "Mark Resolved"}
                    </button>
                  </div>
                </article>
              ))
            )}
          </div>
        </section>

        <section className="attendanceHistory">
          <div className="attendanceHistoryHead">
            <h2>Recent Shifts</h2>
            <button
              type="button"
              className="ghost"
              onClick={() => void fetchSnapshot()}
              disabled={loadingSnapshot}
            >
              {loadingSnapshot ? "Refreshing..." : "Refresh"}
            </button>
          </div>

          <div className="attendanceTableWrap">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Clock In</th>
                  <th>Clock Out</th>
                  <th>Work</th>
                  <th>Break</th>
                  <th>State</th>
                  <th>Note</th>
                </tr>
              </thead>
              <tbody>
                {(snapshot?.recentShifts || []).map((shift) => (
                  <tr key={shift.shiftId}>
                    <td>{shift.shiftDate}</td>
                    <td>{formatDateTime(shift.clockInAt)}</td>
                    <td>{formatDateTime(shift.clockOutAt)}</td>
                    <td>{formatDuration(shift.totalWorkMinutes)}</td>
                    <td>{formatDuration(shift.totalBreakMinutes)}</td>
                    <td>{shift.status === "open" ? "Open" : "Closed"}</td>
                    <td>{shift.note || "-"}</td>
                  </tr>
                ))}
                {snapshot?.recentShifts?.length ? null : (
                  <tr>
                    <td colSpan={7}>No shifts yet. Start by clocking in.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </section>
  );
}
