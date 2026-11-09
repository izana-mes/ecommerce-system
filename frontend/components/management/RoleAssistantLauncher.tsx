"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { MessageSquare } from "lucide-react";

const RoleAssistant = dynamic(() => import("./RoleAssistant"), {
  ssr: false,
  loading: () => <div role="status" style={{ position: "fixed", right: 24, bottom: 88, zIndex: 1000, padding: 16, background: "#fff", color: "#111", border: "1px solid #ddd" }}>Loading assistant…</div>,
});

export default function RoleAssistantLauncher({ role }: { role: "admin" | "seller" | "supplier" | "shipper" }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} aria-haspopup="dialog" aria-expanded={open}
        style={{ position: "fixed", right: 16, bottom: 16, zIndex: 999, display: "inline-flex", alignItems: "center", gap: 8, border: "1px solid #171717", borderRadius: 4, padding: "9px 12px", background: "#171717", color: "#fff", cursor: "pointer", fontSize: 13, fontWeight: 600 }}>
        <MessageSquare size={15} strokeWidth={1.8} />
        {role[0].toUpperCase() + role.slice(1)} Assistant
      </button>
      {open ? <RoleAssistant role={role} onClose={() => setOpen(false)} /> : null}
    </>
  );
}
