"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { MdRefresh, MdSend, MdMyLocation, MdSignalWifi4Bar } from "react-icons/md";
import {getUser } from "@/lib/auth";
import { publicBackendOriginUrl } from "@/lib/backendApiBase";
import { Client, IMessage } from "@stomp/stompjs";
import SockJS from "sockjs-client";
import toast from "react-hot-toast";

interface LocationPayload {
  shipperUserId: string;
  orderId: number | null;
  lat: number;
  lng: number;
  speed: number | null;
  heading: number | null;
  accuracy: number | null;
  recordedAt: string;
}

interface LogEntry {
  time: string;
  lat: number;
  lng: number;
  orderId: number | null;
  source: string;
}

export default function ShipperTrackingPage() {
  const user = getUser();
  const shipperUserId = user?.id as string | undefined;

  const [form, setForm] = useState({
    orderId: "",
    lat: "",
    lng: "",
    speed: "",
    heading: "",
    accuracy: ""});
  const [sending, setSending] = useState(false);
  const [latestLocation, setLatestLocation] = useState<LocationPayload | null>(null);
  const [log, setLog] = useState<LogEntry[]>([]);
  const [wsConnected, setWsConnected] = useState(false);
  const [fetchingLatest, setFetchingLatest] = useState(false);
  const stompRef = useRef<Client | null>(null);
  const logRef = useRef<HTMLDivElement>(null);

  const pushLog = (payload: LocationPayload) => {
    setLog((prev) => [
      {
        time: new Date().toLocaleTimeString(),
        lat: payload.lat,
        lng: payload.lng,
        orderId: payload.orderId,
        source: "WS"},
      ...prev.slice(0, 49),
    ]);
  };

  // WebSocket subscription
  useEffect(() => {
    if (!shipperUserId) return;
    if (!token) return;

    const client = new Client({
      webSocketFactory: () => new SockJS(`${publicBackendOriginUrl()}/ws`) as WebSocket,
      connectHeaders: { },
      reconnectDelay: 5000,
      onConnect: () => {
        setWsConnected(true);
        client.subscribe(`/topic/shippers/${shipperUserId}/tracking`, (msg: IMessage) => {
          try {
            const payload = JSON.parse(msg.body) as LocationPayload;
            setLatestLocation(payload);
            pushLog(payload);
          } catch {/* ignore */}
        });
      },
      onDisconnect: () => setWsConnected(false),
      onStompError: () => setWsConnected(false)});

    client.activate();
    stompRef.current = client;
    return () => { void client.deactivate(); };
  }, [shipperUserId]);

  const fetchLatest = useCallback(async () => {
    if (!token || !shipperUserId) return;
    setFetchingLatest(true);
    try {
      const res = await fetch(`/api/v1/shipper/shippers/${shipperUserId}/location/latest`, {
        headers: { }});
      const data = await res.json();
      if (res.ok && data?.data) setLatestLocation(data.data);
    } catch {/* silent */} finally {
      setFetchingLatest(false);
    }
  }, [shipperUserId]);

  useEffect(() => { void fetchLatest(); }, [fetchLatest]);

  const handleSend = async () => {
    if (!token) return;
    if (!form.lat || !form.lng) {
      toast.error("Latitude and longitude are required");
      return;
    }
    setSending(true);
    try {
      const body: Record<string, unknown> = {
        lat: parseFloat(form.lat),
        lng: parseFloat(form.lng),
        timestampEpochMs: Date.now()};
      if (form.orderId) body.orderId = parseInt(form.orderId);
      if (form.speed) body.speed = parseFloat(form.speed);
      if (form.heading) body.heading = parseFloat(form.heading);
      if (form.accuracy) body.accuracy = parseFloat(form.accuracy);

      const res = await fetch("/api/v1/shipper/location", {
        method: "POST",
        headers: { "Content-Type": "application/json"},
        body: JSON.stringify(body)});
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "Failed to update location");
      toast.success("📍 Location updated");
      if (data?.data) setLatestLocation(data.data);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setSending(false);
    }
  };

  const useCurrentGPS = () => {
    if (!("geolocation" in navigator)) {
      toast.error("Geolocation not supported");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setForm((prev) => ({
          ...prev,
          lat: pos.coords.latitude.toFixed(7),
          lng: pos.coords.longitude.toFixed(7),
          accuracy: pos.coords.accuracy?.toFixed(1) ?? "",
          speed: pos.coords.speed ? pos.coords.speed.toFixed(1) : "",
          heading: pos.coords.heading ? pos.coords.heading.toFixed(1) : ""}));
        toast.success("GPS coordinates loaded");
      },
      () => toast.error("Could not get GPS location")
    );
  };

  return (
    <>
      <div className="sh-topbar">
        <div className="sh-topbar-title">
          <h1>Live Tracking</h1>
          <p>Push your GPS coordinates and monitor the live feed</p>
        </div>
        <div className="sh-topbar-actions">
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span className={wsConnected ? "sh-live-dot" : undefined}
              style={!wsConnected ? { width: 8, height: 8, borderRadius: "50%", background: "#ef4444", display: "inline-block" } : {}} />
            <span style={{ fontSize: 13, color: wsConnected ? "#34d399" : "#f87171" }}>
              {wsConnected ? "Live" : "Offline"}
            </span>
          </div>
          <button className="sh-btn sh-btn-secondary sh-btn-sm" onClick={() => void fetchLatest()} disabled={fetchingLatest}>
            <MdRefresh /> {fetchingLatest ? "Loading…" : "Refresh"}
          </button>
        </div>
      </div>

      <div className="sh-content">
        <div className="sh-row" style={{ alignItems: "flex-start" }}>

          {/* ── Push location form ── */}
          <div className="sh-card" style={{ flex: "1 1 340px" }}>
            <div className="sh-card-header">
              <div>
                <h2 className="sh-card-title">Send Location Update</h2>
                <p className="sh-card-subtitle">Push your current GPS coordinates to the server</p>
              </div>
            </div>

            <div className="sh-section-gap">
              <div className="sh-form-grid sh-form-grid-2">
                <div className="sh-form-group">
                  <label className="sh-label">Latitude *</label>
                  <input
                    className="sh-input"
                    placeholder="e.g. 10.7769"
                    value={form.lat}
                    onChange={(e) => setForm((p) => ({ ...p, lat: e.target.value }))}
                  />
                </div>
                <div className="sh-form-group">
                  <label className="sh-label">Longitude *</label>
                  <input
                    className="sh-input"
                    placeholder="e.g. 106.7009"
                    value={form.lng}
                    onChange={(e) => setForm((p) => ({ ...p, lng: e.target.value }))}
                  />
                </div>
              </div>

              <div className="sh-form-grid sh-form-grid-2">
                <div className="sh-form-group">
                  <label className="sh-label">Order ID (optional)</label>
                  <input
                    className="sh-input"
                    placeholder="e.g. 42"
                    value={form.orderId}
                    onChange={(e) => setForm((p) => ({ ...p, orderId: e.target.value }))}
                  />
                </div>
                <div className="sh-form-group">
                  <label className="sh-label">Accuracy (m)</label>
                  <input
                    className="sh-input"
                    placeholder="e.g. 5"
                    value={form.accuracy}
                    onChange={(e) => setForm((p) => ({ ...p, accuracy: e.target.value }))}
                  />
                </div>
                <div className="sh-form-group">
                  <label className="sh-label">Speed (km/h)</label>
                  <input
                    className="sh-input"
                    placeholder="e.g. 30"
                    value={form.speed}
                    onChange={(e) => setForm((p) => ({ ...p, speed: e.target.value }))}
                  />
                </div>
                <div className="sh-form-group">
                  <label className="sh-label">Heading (°)</label>
                  <input
                    className="sh-input"
                    placeholder="e.g. 180"
                    value={form.heading}
                    onChange={(e) => setForm((p) => ({ ...p, heading: e.target.value }))}
                  />
                </div>
              </div>

              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <button className="sh-btn sh-btn-secondary sh-btn-sm" onClick={useCurrentGPS}>
                  <MdMyLocation /> Use GPS
                </button>
                <button
                  className="sh-btn sh-btn-primary"
                  onClick={() => void handleSend()}
                  disabled={sending}
                  style={{ flex: 1 }}
                >
                  <MdSend /> {sending ? "Sending…" : "Send Location"}
                </button>
              </div>
            </div>
          </div>

          {/* ── Right column: latest + feed ── */}
          <div style={{ flex: "1 1 340px", display: "flex", flexDirection: "column", gap: 20 }}>

            {/* Latest location card */}
            <div className="sh-card">
              <div className="sh-card-header">
                <div>
                  <h2 className="sh-card-title">Latest Known Location</h2>
                  <p className="sh-card-subtitle">Last recorded position from server</p>
                </div>
              </div>
              {latestLocation ? (
                <div style={{ display: "grid", gap: 12 }}>
                  {[
                    { label: "Latitude", value: latestLocation.lat },
                    { label: "Longitude", value: latestLocation.lng },
                    { label: "Order ID", value: latestLocation.orderId ?? "—" },
                    {
                      label: "Recorded At",
                      value: new Date(latestLocation.recordedAt).toLocaleString()},
                  ].map((row) => (
                    <div
                      key={row.label}
                      style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid rgba(255,255,255,0.05)", paddingBottom: 10 }}
                    >
                      <span style={{ fontSize: 13, color: "#64748b" }}>{row.label}</span>
                      <span style={{ fontSize: 13, fontWeight: 600, color: "#f1f5f9" }}>{String(row.value)}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p style={{ color: "#475569", textAlign: "center", padding: "24px 0" }}>No location data yet</p>
              )}
            </div>

            {/* Live WS feed */}
            <div className="sh-card">
              <div className="sh-card-header">
                <div>
                  <h2 className="sh-card-title" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span className={wsConnected ? "sh-live-dot" : undefined}
                      style={!wsConnected ? { width: 8, height: 8, borderRadius: "50%", background: "#ef4444", display: "inline-block" } : {}} />
                    WebSocket Feed
                  </h2>
                  <p className="sh-card-subtitle">Live location broadcasts via STOMP</p>
                </div>
                <button
                  className="sh-btn sh-btn-secondary sh-btn-sm"
                  onClick={() => setLog([])}
                >
                  Clear
                </button>
              </div>
              <div className="sh-log-feed" ref={logRef}>
                {log.length === 0 ? (
                  <span style={{ color: "#475569" }}>Waiting for location events…</span>
                ) : (
                  log.map((entry, i) => (
                    <div key={i} className="sh-log-entry">
                      <span className="sh-log-time">[{entry.time}]</span>
                      <span className="sh-log-msg">
                        📍 {entry.lat}, {entry.lng}
                        {entry.orderId ? ` · Order #${entry.orderId}` : ""}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>

          </div>
        </div>
      </div>
    </>
  );
}
