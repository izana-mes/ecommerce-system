"use client";

import { CSSProperties, useRef, useState } from "react";
import { getToken } from "@/lib/auth";
import toast from "react-hot-toast";

type UploadResult = {
  id: string;
  actionType: string;
  status: string;
  createdAt: string;
};

export default function SupplierBulkUploadPage() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<UploadResult | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const handleFileChange = (file: File | null) => {
    if (!file) return;
    if (!file.name.endsWith(".csv")) {
      toast.error("Please select a .csv file");
      return;
    }
    setSelectedFile(file);
    setResult(null);
  };

  const downloadTemplate = async () => {
    const token = getToken();
    if (!token) return;
    try {
      const res = await fetch("/api/v1/supplier/catalog/csv-template", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to download template");
      const text = await res.text();
      const blob = new Blob([text], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "supplier-product-template.csv";
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      // Fall back to a built-in template
      const template = "productID,productName,category,productPrice,stockQuantity,sizes,active\nEXAMPLE-001,Example Product,Electronics,29.99,100,S|M|L,true\n";
      const blob = new Blob([template], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = "supplier-product-template.csv"; a.click();
      URL.revokeObjectURL(url);
    }
  };

  const upload = async () => {
    if (!selectedFile) { toast.error("Please select a CSV file first"); return; }
    const token = getToken();
    if (!token) return;

    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", selectedFile);
      const res = await fetch("/api/v1/supplier/catalog/csv-bulk", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || data?.error || "Upload failed");
      toast.success(data?.message || "Bulk upload submitted for admin approval");
      setResult(data?.data ?? null);
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div style={containerStyle}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={titleStyle}>CSV Bulk Upload</h1>
        <p style={subtitleStyle}>
          Upload a CSV file to submit multiple product proposals at once. Each row becomes a BULK_UPSERT change request that goes through the standard admin approval workflow.
        </p>
      </div>

      {/* How it works */}
      <div style={infoBoxStyle}>
        <h2 style={{ margin: "0 0 14px", fontSize: 17, fontWeight: 700, color: "#0f172a" }}>📋 How it works</h2>
        <ol style={{ margin: 0, paddingLeft: 20, color: "#475569", fontSize: 14, lineHeight: 2 }}>
          <li>Download the CSV template below.</li>
          <li>Fill in your product data — one product per row.</li>
          <li>Upload the completed CSV using the form below.</li>
          <li>Your submission will be reviewed by an admin and approved or rejected.</li>
          <li>Track the outcome in your <strong>Catalog Management</strong> submission history.</li>
        </ol>
        <div style={csvSpecStyle}>
          <strong style={{ display: "block", marginBottom: 8, color: "#0f172a" }}>Required columns:</strong>
          <code style={{ display: "block", background: "#f1f5f9", padding: "10px 14px", borderRadius: 8, fontSize: 13, color: "#334155", lineHeight: 1.8 }}>
            productID, productName, productPrice
          </code>
          <strong style={{ display: "block", margin: "12px 0 8px", color: "#0f172a" }}>Optional columns:</strong>
          <code style={{ display: "block", background: "#f1f5f9", padding: "10px 14px", borderRadius: 8, fontSize: 13, color: "#334155", lineHeight: 1.8 }}>
            category, stockQuantity, sizes (pipe-separated: S|M|L|XL), active (true/false)
          </code>
        </div>
        <button type="button" onClick={() => void downloadTemplate()} style={templateButtonStyle}>
          ⬇ Download CSV Template
        </button>
      </div>

      {/* Drop zone */}
      <div
        style={{
          ...dropZoneStyle,
          borderColor: dragOver ? "#14b8a6" : selectedFile ? "#14b8a6" : "#e2e8f0",
          background: dragOver ? "#f0fdfa" : selectedFile ? "#f0fdfa" : "#fafafa",
        }}
        onDragOver={e => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={e => {
          e.preventDefault();
          setDragOver(false);
          handleFileChange(e.dataTransfer.files[0] ?? null);
        }}
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv"
          style={{ display: "none" }}
          onChange={e => handleFileChange(e.target.files?.[0] ?? null)}
        />
        <div style={{ fontSize: 40, marginBottom: 12 }}>{selectedFile ? "✅" : "📤"}</div>
        {selectedFile ? (
          <>
            <div style={{ fontWeight: 700, fontSize: 16, color: "#0f172a", marginBottom: 4 }}>{selectedFile.name}</div>
            <div style={{ color: "#64748b", fontSize: 14 }}>{(selectedFile.size / 1024).toFixed(1)} KB · Click to change</div>
          </>
        ) : (
          <>
            <div style={{ fontWeight: 600, fontSize: 16, color: "#0f172a", marginBottom: 4 }}>Drag & drop your CSV here</div>
            <div style={{ color: "#64748b", fontSize: 14 }}>or click to browse files</div>
          </>
        )}
      </div>

      {/* Upload button */}
      <div style={{ display: "flex", gap: 12, marginTop: 20, flexWrap: "wrap" }}>
        <button
          type="button"
          onClick={() => void upload()}
          disabled={!selectedFile || uploading}
          style={{
            ...uploadButtonStyle,
            opacity: !selectedFile || uploading ? 0.6 : 1,
            cursor: !selectedFile || uploading ? "not-allowed" : "pointer",
          }}
        >
          {uploading ? "Uploading…" : "🚀 Submit Bulk Upload for Approval"}
        </button>
        {selectedFile && (
          <button
            type="button"
            onClick={() => { setSelectedFile(null); if (fileInputRef.current) fileInputRef.current.value = ""; }}
            style={clearButtonStyle}
          >
            ✕ Clear
          </button>
        )}
      </div>

      {/* Result */}
      {result && (
        <div style={resultBoxStyle}>
          <div style={{ fontSize: 36, marginBottom: 10 }}>🎉</div>
          <h3 style={{ margin: "0 0 8px", fontSize: 18, fontWeight: 700, color: "#0f166e" }}>Upload Submitted!</h3>
          <p style={{ color: "#475569", fontSize: 14, margin: "0 0 16px" }}>
            Your bulk product submission is now pending admin review.
          </p>
          <div style={resultGridStyle}>
            {[
              { label: "Request ID", value: result.id },
              { label: "Action", value: result.actionType },
              { label: "Status", value: result.status },
              { label: "Submitted", value: result.createdAt ? new Date(result.createdAt).toLocaleString() : "—" },
            ].map(r => (
              <div key={r.label} style={resultRowStyle}>
                <span style={{ color: "#64748b", fontSize: 13 }}>{r.label}</span>
                <strong style={{ fontSize: 13, color: "#0f172a", fontFamily: r.label === "Request ID" ? "monospace" : "inherit" }}>
                  {r.value}
                </strong>
              </div>
            ))}
          </div>
          <p style={{ color: "#64748b", fontSize: 13, marginTop: 12, margin: "12px 0 0" }}>
            Track the outcome in <strong>Catalog Management → Submission history</strong>.
          </p>
        </div>
      )}
    </div>
  );
}

const containerStyle: CSSProperties = { padding: "36px 32px", maxWidth: 840, margin: "0 auto" };
const titleStyle: CSSProperties = { margin: 0, fontSize: 28, fontWeight: 800, color: "#0f172a", letterSpacing: "-0.02em" };
const subtitleStyle: CSSProperties = { margin: "10px 0 0", color: "#64748b", fontSize: 15, lineHeight: 1.6, maxWidth: 640 };
const infoBoxStyle: CSSProperties = { background: "#fff", borderRadius: 16, border: "1px solid #e2e8f0", padding: "24px 28px", marginBottom: 24, boxShadow: "0 1px 4px rgba(15,23,42,0.05)" };
const csvSpecStyle: CSSProperties = { marginTop: 18 };
const templateButtonStyle: CSSProperties = { display: "inline-flex", alignItems: "center", gap: 8, marginTop: 18, padding: "10px 20px", borderRadius: 10, background: "#f0fdfa", color: "#0f766e", border: "1.5px solid #99f6e4", fontWeight: 700, fontSize: 14, cursor: "pointer" };
const dropZoneStyle: CSSProperties = { border: "2px dashed #e2e8f0", borderRadius: 16, padding: "48px 32px", textAlign: "center", cursor: "pointer", transition: "all 0.2s", userSelect: "none" };
const uploadButtonStyle: CSSProperties = { background: "#0f766e", color: "#fff", border: "none", borderRadius: 12, padding: "14px 28px", fontWeight: 700, fontSize: 15 };
const clearButtonStyle: CSSProperties = { background: "#fff", color: "#64748b", border: "1px solid #e2e8f0", borderRadius: 12, padding: "14px 20px", fontWeight: 600, fontSize: 14, cursor: "pointer" };
const resultBoxStyle: CSSProperties = { marginTop: 28, background: "#f0fdf4", border: "1.5px solid #86efac", borderRadius: 16, padding: "28px 32px", textAlign: "center" };
const resultGridStyle: CSSProperties = { display: "grid", gap: 10, textAlign: "left", background: "#fff", borderRadius: 12, padding: "16px 20px", border: "1px solid #e2e8f0" };
const resultRowStyle: CSSProperties = { display: "flex", justifyContent: "space-between", gap: 20, borderBottom: "1px solid #f1f5f9", paddingBottom: 8 };
