"use client";

import { useEffect, useState, useCallback } from "react";
import { getToken } from "@/lib/auth";
import toast from "react-hot-toast";

type IssueDto = {
  id: number;
  sourceTable: "LOG" | "HELP";
  orderId: number;
  orderNumber: string;
  shipperUserId: string;
  shipperEmail: string;
  issueType: string;
  message: string;
  priority: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
};

type RespondModalProps = {
  issue: IssueDto | null;
  onClose: () => void;
  onResponded: () => void;
};

function RespondIssueModal({ issue, onClose, onResponded }: RespondModalProps) {
  const [response, setResponse] = useState("");
  const [markResolved, setMarkResolved] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setResponse("");
    setMarkResolved(false);
  }, [issue]);

  if (!issue) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!response.trim() && !markResolved) return toast.error("Provide a response or mark as resolved");

    try {
      setSubmitting(true);
      const url = issue.sourceTable === "LOG" 
        ? `/api/v1/staff/issues/logs/${issue.id}/respond`
        : `/api/v1/staff/issues/help/${issue.id}/respond`;

      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({ response, markResolved }),
      });

      if (!res.ok) throw new Error("Failed to submit response");
      toast.success("Successfully responded to issue");
      onResponded();
    } catch (err: any) {
      toast.error(err.message || "Failed to submit response");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
      <div style={{ background: "#fff", padding: 24, borderRadius: 12, width: "100%", maxWidth: 500 }}>
        <h3 style={{ margin: "0 0 16px", fontSize: 18, fontWeight: 600 }}>
          Respond to Issue / Request
        </h3>
        
        <div style={{ background: "#f9fafb", padding: 12, borderRadius: 8, marginBottom: 16 }}>
          <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 4 }}>Shipper Message:</div>
          <div style={{ fontSize: 14, color: "#111827", whiteSpace: "pre-wrap" }}>{issue.message}</div>
        </div>
        
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div>
            <label style={{ display: "block", fontSize: 14, fontWeight: 500, marginBottom: 6 }}>Your Response</label>
            <textarea 
              value={response} 
              onChange={(e) => setResponse(e.target.value)}
              style={{ width: "100%", padding: "10px", borderRadius: 6, border: "1px solid #d1d5db", minHeight: 80 }}
              placeholder="Type your instruction or response to the shipper..."
            />
          </div>
          
          <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 14 }}>
            <input 
              type="checkbox" 
              checked={markResolved}
              onChange={(e) => setMarkResolved(e.target.checked)}
              style={{ width: 16, height: 16 }}
            />
            Mark Issue as Resolved
          </label>
          
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 8 }}>
            <button type="button" onClick={onClose} style={{ padding: "8px 16px", borderRadius: 6, border: "1px solid #d1d5db", background: "transparent", cursor: "pointer" }}>Cancel</button>
            <button type="submit" disabled={submitting} style={{ padding: "8px 16px", borderRadius: 6, border: "none", background: "#4f46e5", color: "#fff", cursor: "pointer", fontWeight: 500 }}>
              {submitting ? "Submitting..." : "Submit Response"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function StaffIssuesPage() {
  const [issues, setIssues] = useState<IssueDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("OPEN");
  const [respondIssue, setRespondIssue] = useState<IssueDto | null>(null);

  const fetchIssues = useCallback(async () => {
    try {
      setLoading(true);
      const url = statusFilter ? `/api/v1/staff/issues?status=${statusFilter}` : `/api/v1/staff/issues`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (!res.ok) throw new Error("Failed to load issues");
      setIssues(await res.json());
    } catch (err: any) {
      toast.error(err.message || "Failed to load issues");
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    fetchIssues();
  }, [fetchIssues]);

  return (
    <div style={{ padding: "32px 40px", maxWidth: 1200, margin: "0 auto" }}>
      <h1 style={{ margin: "0 0 24px", fontSize: 24, fontWeight: 700, color: "#111827" }}>
        Issue & Help Requests ({issues.length})
      </h1>
      
      <div style={{ display: "flex", gap: 16, marginBottom: 24 }}>
        <button 
          onClick={() => setStatusFilter("OPEN")}
          style={{ padding: "8px 16px", borderRadius: 20, fontSize: 14, fontWeight: 500, cursor: "pointer", 
                   border: statusFilter === "OPEN" ? "none" : "1px solid #d1d5db", 
                   background: statusFilter === "OPEN" ? "#374151" : "#fff",
                   color: statusFilter === "OPEN" ? "#fff" : "#374151" }}
        >
          Open Issues
        </button>
        <button 
          onClick={() => setStatusFilter("RESOLVED")}
          style={{ padding: "8px 16px", borderRadius: 20, fontSize: 14, fontWeight: 500, cursor: "pointer", 
                   border: statusFilter === "RESOLVED" ? "none" : "1px solid #d1d5db", 
                   background: statusFilter === "RESOLVED" ? "#374151" : "#fff",
                   color: statusFilter === "RESOLVED" ? "#fff" : "#374151" }}
        >
          Resolved Issues
        </button>
        <button 
          onClick={() => setStatusFilter("")}
          style={{ padding: "8px 16px", borderRadius: 20, fontSize: 14, fontWeight: 500, cursor: "pointer", 
                   border: statusFilter === "" ? "none" : "1px solid #d1d5db", 
                   background: statusFilter === "" ? "#374151" : "#fff",
                   color: statusFilter === "" ? "#fff" : "#374151" }}
        >
          All
        </button>
      </div>

      <div style={{ background: "#fff", borderRadius: 12, boxShadow: "0 1px 3px rgba(0,0,0,0.1)", overflow: "hidden" }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: "center", color: "#6b7280" }}>Loading issues...</div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
              <thead>
                <tr style={{ background: "#f9fafb", borderBottom: "1px solid #e5e7eb" }}>
                  <th style={{ padding: "12px 16px", color: "#6b7280", fontSize: 13, fontWeight: 500, width: "15%" }}>Type / Order</th>
                  <th style={{ padding: "12px 16px", color: "#6b7280", fontSize: 13, fontWeight: 500, width: "15%" }}>Shipper</th>
                  <th style={{ padding: "12px 16px", color: "#6b7280", fontSize: 13, fontWeight: 500, width: "45%" }}>Message Thread</th>
                  <th style={{ padding: "12px 16px", color: "#6b7280", fontSize: 13, fontWeight: 500, width: "10%" }}>Status</th>
                  <th style={{ padding: "12px 16px", color: "#6b7280", fontSize: 13, fontWeight: 500, width: "15%" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {issues.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ padding: 24, textAlign: "center", color: "#6b7280" }}>No issues found</td>
                  </tr>
                ) : (
                  issues.map(issue => (
                    <tr key={`${issue.sourceTable}-${issue.id}`} style={{ borderBottom: "1px solid #e5e7eb", verticalAlign: "top" }}>
                      <td style={{ padding: "16px" }}>
                        <div style={{ display: "inline-block", background: issue.sourceTable === "HELP" ? "#dbeafe" : "#fef3c7", color: issue.sourceTable === "HELP" ? "#1d4ed8" : "#b45309", padding: "2px 6px", borderRadius: 4, fontSize: 11, fontWeight: 600, marginBottom: 4 }}>
                          {issue.sourceTable === "HELP" ? "HELP REQUEST" : "ISSUE LOG"}
                        </div>
                        <div style={{ fontSize: 13, fontWeight: 500, color: "#111827" }}>#{issue.orderNumber}</div>
                        <div style={{ fontSize: 12, color: "#6b7280", marginTop: 4 }}>{new Date(issue.createdAt).toLocaleString()}</div>
                      </td>
                      <td style={{ padding: "16px", fontSize: 13, color: "#4b5563" }}>
                        <div style={{ color: "#111827", fontWeight: 500 }}>{issue.shipperEmail}</div>
                      </td>
                      <td style={{ padding: "16px", fontSize: 13, color: "#374151", whiteSpace: "pre-wrap", lineHeight: 1.5 }}>
                        {issue.issueType && issue.issueType !== issue.message && <strong style={{ display: "block" }}>{issue.issueType}</strong>}
                        {issue.message}
                      </td>
                      <td style={{ padding: "16px" }}>
                        <span style={{ 
                          background: issue.status === "RESOLVED" ? "#d1fae5" : "#fee2e2", 
                          color: issue.status === "RESOLVED" ? "#065f46" : "#991b1b", 
                          padding: "4px 8px", 
                          borderRadius: 12, 
                          fontSize: 12, 
                          fontWeight: 500 
                        }}>
                          {issue.status || "OPEN"}
                        </span>
                      </td>
                      <td style={{ padding: "16px" }}>
                        {issue.status !== "RESOLVED" && (
                          <button 
                            onClick={() => setRespondIssue(issue)}
                            style={{ padding: "6px 12px", fontSize: 13, background: "#4f46e5", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: 500 }}
                          >
                            Respond
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <RespondIssueModal 
        issue={respondIssue} 
        onClose={() => setRespondIssue(null)} 
        onResponded={() => { setRespondIssue(null); fetchIssues(); }} 
      />
    </div>
  );
}
