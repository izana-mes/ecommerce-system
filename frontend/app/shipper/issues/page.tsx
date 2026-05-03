"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { MdWarning, MdSend, MdRefresh, MdHelpOutline } from "react-icons/md";
import { getToken, getUser } from "@/lib/auth";
import { Client, IMessage } from "@stomp/stompjs";
import SockJS from "sockjs-client";
import toast from "react-hot-toast";

type IssueType = "CUSTOMER_NOT_AVAILABLE" | "WRONG_ADDRESS" | "DAMAGED_GOODS";
type Priority = "LOW" | "NORMAL" | "HIGH" | "URGENT";

interface Issue {
  id: number;
  orderId: number;
  issueType: IssueType;
  message: string;
  status: "OPEN" | "RESOLVED";
  createdAt: string;
}

interface HelpRequest {
  id: number;
  orderId: number;
  message: string;
  priority: Priority;
  status: "OPEN" | "ACKNOWLEDGED" | "RESOLVED";
  createdAt: string;
}

const ISSUE_TYPE_LABELS: Record<IssueType, string> = {
  CUSTOMER_NOT_AVAILABLE: "Customer Not Available",
  WRONG_ADDRESS: "Wrong Address",
  DAMAGED_GOODS: "Damaged Goods",
};

const PRIORITY_COLORS: Record<Priority, string> = {
  LOW: "sh-badge-gray",
  NORMAL: "sh-badge-blue",
  HIGH: "sh-badge-amber",
  URGENT: "sh-badge-red",
};

export default function ShipperIssuesPage() {
  const user = getUser();
  const shipperUserId = user?.id as string | undefined;

  const [activeTab, setActiveTab] = useState<"issue" | "help">("issue");
  const [issueOrderId, setIssueOrderId] = useState("");
  const [issueType, setIssueType] = useState<IssueType>("CUSTOMER_NOT_AVAILABLE");
  const [issueMessage, setIssueMessage] = useState("");
  const [submittingIssue, setSubmittingIssue] = useState(false);

  const [helpOrderId, setHelpOrderId] = useState("");
  const [helpMessage, setHelpMessage] = useState("");
  const [helpPriority, setHelpPriority] = useState<Priority>("NORMAL");
  const [submittingHelp, setSubmittingHelp] = useState(false);

  const [issueQueryId, setIssueQueryId] = useState("");
  const [issues, setIssues] = useState<Issue[]>([]);
  const [fetchingIssues, setFetchingIssues] = useState(false);

  const [helpLog, setHelpLog] = useState<HelpRequest[]>([]);
  const stompRef = useRef<Client | null>(null);
  const [wsConnected, setWsConnected] = useState(false);

  // WebSocket: listen for help acknowledgements
  useEffect(() => {
    if (!shipperUserId) return;
    const token = getToken();
    if (!token) return;

    const client = new Client({
      webSocketFactory: () => new SockJS("/ws") as WebSocket,
      connectHeaders: { Authorization: `Bearer ${token}` },
      reconnectDelay: 5000,
      onConnect: () => {
        setWsConnected(true);
        client.subscribe(`/topic/help/${shipperUserId}`, (msg: IMessage) => {
          try {
            const req = JSON.parse(msg.body) as HelpRequest;
            toast.success(`🆘 Help request #${req.id} received by admin (${req.status})`);
            setHelpLog((prev) => [req, ...prev.slice(0, 19)]);
          } catch {/* ignore */}
        });
      },
      onDisconnect: () => setWsConnected(false),
    });

    client.activate();
    stompRef.current = client;
    return () => { void client.deactivate(); };
  }, [shipperUserId]);

  const submitIssue = async () => {
    const token = getToken();
    if (!token) return;
    if (!issueOrderId) { toast.error("Order ID is required"); return; }
    setSubmittingIssue(true);
    try {
      const res = await fetch(`/api/v1/shipper/orders/${issueOrderId}/issues`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ issueType, message: issueMessage }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "Failed");
      toast.success("⚠️ Issue reported successfully");
      setIssueMessage("");
      if (issueQueryId === issueOrderId) void fetchIssues(issueOrderId);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setSubmittingIssue(false);
    }
  };

  const submitHelpRequest = async () => {
    const token = getToken();
    if (!token) return;
    if (!helpOrderId) { toast.error("Order ID is required"); return; }
    if (!helpMessage.trim()) { toast.error("Message is required"); return; }
    setSubmittingHelp(true);
    try {
      const res = await fetch(`/api/v1/shipper/orders/${helpOrderId}/help-request`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ message: helpMessage, priority: helpPriority }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "Failed");
      toast.success("🆘 Help request sent to admin");
      setHelpMessage("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setSubmittingHelp(false);
    }
  };

  const fetchIssues = useCallback(async (orderId: string) => {
    const token = getToken();
    if (!token || !orderId) return;
    setFetchingIssues(true);
    try {
      const res = await fetch(`/api/v1/shipper/orders/${orderId}/issues`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "Failed");
      setIssues(Array.isArray(data.data) ? data.data : []);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setFetchingIssues(false);
    }
  }, []);

  const tabStyle = (tab: "issue" | "help") => ({
    padding: "10px 20px",
    borderRadius: "10px 10px 0 0",
    border: "none",
    cursor: "pointer",
    fontSize: 14,
    fontWeight: 600,
    background: activeTab === tab ? "rgba(59,130,246,0.15)" : "transparent",
    color: activeTab === tab ? "#60a5fa" : "#64748b",
    borderBottom: activeTab === tab ? "2px solid #3b82f6" : "2px solid transparent",
    transition: "all 0.2s",
  });

  return (
    <>
      <div className="sh-topbar">
        <div className="sh-topbar-title">
          <h1>Issues & Help</h1>
          <p>Report delivery issues and send help requests to admins</p>
        </div>
        <div className="sh-topbar-actions">
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span
              style={{
                width: 8, height: 8, borderRadius: "50%",
                background: wsConnected ? "#10b981" : "#ef4444",
                display: "inline-block",
              }}
            />
            <span style={{ fontSize: 13, color: wsConnected ? "#34d399" : "#f87171" }}>
              {wsConnected ? "Live" : "Offline"}
            </span>
          </div>
        </div>
      </div>

      <div className="sh-content">
        <div className="sh-row" style={{ alignItems: "flex-start" }}>

          {/* ── Left: Create forms ── */}
          <div style={{ flex: "1 1 360px", display: "flex", flexDirection: "column", gap: 20 }}>
            <div className="sh-card">
              {/* Tabs */}
              <div style={{ display: "flex", gap: 4, marginBottom: 24, borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                <button style={tabStyle("issue")} onClick={() => setActiveTab("issue")}>
                  <MdWarning style={{ verticalAlign: "middle", marginRight: 6 }} />
                  Report Issue
                </button>
                <button style={tabStyle("help")} onClick={() => setActiveTab("help")}>
                  <MdHelpOutline style={{ verticalAlign: "middle", marginRight: 6 }} />
                  Request Help
                </button>
              </div>

              {activeTab === "issue" ? (
                <div className="sh-section-gap">
                  <div className="sh-form-group">
                    <label className="sh-label">Order ID *</label>
                    <input
                      className="sh-input"
                      placeholder="e.g. 42"
                      value={issueOrderId}
                      onChange={(e) => setIssueOrderId(e.target.value)}
                    />
                  </div>
                  <div className="sh-form-group">
                    <label className="sh-label">Issue Type *</label>
                    <select
                      className="sh-select"
                      value={issueType}
                      onChange={(e) => setIssueType(e.target.value as IssueType)}
                    >
                      {(Object.entries(ISSUE_TYPE_LABELS) as [IssueType, string][]).map(([k, v]) => (
                        <option key={k} value={k}>{v}</option>
                      ))}
                    </select>
                  </div>
                  <div className="sh-form-group">
                    <label className="sh-label">Message (optional)</label>
                    <textarea
                      className="sh-textarea"
                      placeholder="Describe the issue in detail…"
                      value={issueMessage}
                      onChange={(e) => setIssueMessage(e.target.value)}
                    />
                  </div>
                  <button
                    className="sh-btn sh-btn-warning"
                    onClick={() => void submitIssue()}
                    disabled={submittingIssue}
                    style={{ width: "100%" }}
                  >
                    <MdSend /> {submittingIssue ? "Submitting…" : "Report Issue"}
                  </button>
                </div>
              ) : (
                <div className="sh-section-gap">
                  <div className="sh-form-group">
                    <label className="sh-label">Order ID *</label>
                    <input
                      className="sh-input"
                      placeholder="e.g. 42"
                      value={helpOrderId}
                      onChange={(e) => setHelpOrderId(e.target.value)}
                    />
                  </div>
                  <div className="sh-form-group">
                    <label className="sh-label">Priority</label>
                    <select
                      className="sh-select"
                      value={helpPriority}
                      onChange={(e) => setHelpPriority(e.target.value as Priority)}
                    >
                      <option value="LOW">Low</option>
                      <option value="NORMAL">Normal</option>
                      <option value="HIGH">High</option>
                      <option value="URGENT">Urgent 🚨</option>
                    </select>
                  </div>
                  <div className="sh-form-group">
                    <label className="sh-label">Message *</label>
                    <textarea
                      className="sh-textarea"
                      placeholder="Describe what help you need…"
                      value={helpMessage}
                      onChange={(e) => setHelpMessage(e.target.value)}
                    />
                  </div>
                  <button
                    className="sh-btn sh-btn-danger"
                    onClick={() => void submitHelpRequest()}
                    disabled={submittingHelp}
                    style={{ width: "100%", background: "linear-gradient(135deg,#ef4444,#dc2626)", color: "#fff" }}
                  >
                    <MdSend /> {submittingHelp ? "Sending…" : "Send Help Request"}
                  </button>
                </div>
              )}
            </div>

            {/* Help WS log */}
            {helpLog.length > 0 && (
              <div className="sh-card">
                <h2 className="sh-card-title" style={{ marginBottom: 14 }}>Help Request Log</h2>
                <div className="sh-log-feed">
                  {helpLog.map((req) => (
                    <div key={req.id} className="sh-log-entry">
                      <span className="sh-log-time">#{req.id}</span>
                      <span className="sh-log-msg">
                        Order #{req.orderId} · {req.priority} · {req.status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* ── Right: Issue list ── */}
          <div className="sh-card" style={{ flex: "1 1 360px" }}>
            <div className="sh-card-header">
              <div>
                <h2 className="sh-card-title">Issue Log</h2>
                <p className="sh-card-subtitle">Search issues by order ID</p>
              </div>
              <button
                className="sh-btn sh-btn-secondary sh-btn-sm"
                onClick={() => void fetchIssues(issueQueryId)}
                disabled={fetchingIssues || !issueQueryId}
              >
                <MdRefresh />
              </button>
            </div>

            <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
              <input
                className="sh-input"
                placeholder="Order ID"
                value={issueQueryId}
                onChange={(e) => setIssueQueryId(e.target.value)}
                style={{ flex: 1 }}
              />
              <button
                className="sh-btn sh-btn-primary sh-btn-sm"
                onClick={() => void fetchIssues(issueQueryId)}
                disabled={fetchingIssues || !issueQueryId}
              >
                Search
              </button>
            </div>

            <div className="sh-table-wrap">
              <table className="sh-table">
                <thead>
                  <tr>
                    <th>Type</th>
                    <th>Message</th>
                    <th>Status</th>
                    <th>Created</th>
                  </tr>
                </thead>
                <tbody>
                  {fetchingIssues ? (
                    <tr><td colSpan={4} className="sh-table-empty">Loading…</td></tr>
                  ) : issues.length === 0 ? (
                    <tr><td colSpan={4} className="sh-table-empty">No issues found. Search by order ID above.</td></tr>
                  ) : (
                    issues.map((issue) => (
                      <tr key={issue.id}>
                        <td>
                          <span className="sh-badge sh-badge-amber">
                            {ISSUE_TYPE_LABELS[issue.issueType] ?? issue.issueType}
                          </span>
                        </td>
                        <td style={{ maxWidth: 240, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                          {issue.message || "—"}
                        </td>
                        <td>
                          <span className={`sh-badge ${issue.status === "RESOLVED" ? "sh-badge-green" : "sh-badge-gray"}`}>
                            {issue.status}
                          </span>
                        </td>
                        <td style={{ whiteSpace: "nowrap" }}>
                          {new Date(issue.createdAt).toLocaleDateString()}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      </div>
    </>
  );
}
