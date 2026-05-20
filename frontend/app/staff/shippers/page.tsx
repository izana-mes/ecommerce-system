"use client";

import { useEffect, useState } from "react";
import {}  from "@/lib/auth";
import toast from "react-hot-toast";

type ShipperDto = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  activeOrderCount: number;
};

type ShipperLocationDto = {
  shipperUserId: string;
  orderId: number | null;
  latitude: number;
  longitude: number;
  speed: number;
  heading: number;
  accuracyMeters: number;
  recordedAt: string;
};

function LocationModal({ shipper, onClose }: { shipper: ShipperDto | null, onClose: () => void }) {
  const [location, setLocation] = useState<ShipperLocationDto | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!shipper) return;
    const fetchLocation = async () => {
      try {
        const res = await fetch(`/api/v1/staff/shippers/${shipper.id}/location`, {
          headers: { }
        });
        if (res.status === 404) {
          setLocation(null);
        } else if (res.ok) {
          setLocation(await res.json());
        } else {
          throw new Error("Failed to fetch location");
        }
      } catch (err: any) {
        toast.error(err.message || "Could not load location.");
      } finally {
        setLoading(false);
      }
    };
    fetchLocation();
  }, [shipper]);

  if (!shipper) return null;

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
      <div style={{ background: "#fff", padding: 24, borderRadius: 12, width: "100%", maxWidth: 400 }}>
        <h3 style={{ margin: "0 0 16px", fontSize: 18, fontWeight: 600 }}>
          Latest Location: {shipper.firstName}
        </h3>
        
        {loading ? (
          <p>Loading GPS coordinates...</p>
        ) : !location ? (
          <p style={{ color: "#6b7280" }}>No location history available for this shipper.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <div style={{ background: "#f3f4f6", padding: 12, borderRadius: 8 }}>
                <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 4 }}>Latitude</div>
                <div style={{ fontWeight: 500 }}>{location.latitude.toFixed(6)}</div>
              </div>
              <div style={{ background: "#f3f4f6", padding: 12, borderRadius: 8 }}>
                <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 4 }}>Longitude</div>
                <div style={{ fontWeight: 500 }}>{location.longitude.toFixed(6)}</div>
              </div>
              <div style={{ background: "#f3f4f6", padding: 12, borderRadius: 8 }}>
                <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 4 }}>Speed</div>
                <div style={{ fontWeight: 500 }}>{location.speed.toFixed(1)} m/s</div>
              </div>
              <div style={{ background: "#f3f4f6", padding: 12, borderRadius: 8 }}>
                <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 4 }}>Accuracy</div>
                <div style={{ fontWeight: 500 }}>±{location.accuracyMeters.toFixed(1)}m</div>
              </div>
            </div>
            <div style={{ fontSize: 13, color: "#6b7280", marginTop: 8 }}>
              Recorded at: {new Date(location.recordedAt).toLocaleString()}
              {location.orderId && <div>Order Context: #{location.orderId}</div>}
            </div>
          </div>
        )}
        
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 24 }}>
          <button onClick={onClose} style={{ padding: "8px 16px", borderRadius: 6, border: "none", background: "#4f46e5", color: "#fff", cursor: "pointer", fontWeight: 500 }}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

export default function StaffShippersPage() {
  const [shippers, setShippers] = useState<ShipperDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewingLocationFor, setViewingLocationFor] = useState<ShipperDto | null>(null);

  useEffect(() => {
    fetchShippers();
  }, []);

  const fetchShippers = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/v1/staff/shippers", {
        headers: { }});
      if (!res.ok) throw new Error("Failed to load shippers");
      setShippers(await res.json());
    } catch (err: any) {
      toast.error(err.message || "Failed to load shippers");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: "32px 40px", maxWidth: 900, margin: "0 auto" }}>
      <h1 style={{ margin: "0 0 24px", fontSize: 24, fontWeight: 700, color: "#111827" }}>
        Active Shippers ({shippers.length})
      </h1>
      
      <div style={{ background: "#fff", borderRadius: 12, boxShadow: "0 1px 3px rgba(0,0,0,0.1)", overflow: "hidden" }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: "center", color: "#6b7280" }}>Loading shippers...</div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
            <thead>
              <tr style={{ background: "#f9fafb", borderBottom: "1px solid #e5e7eb" }}>
                <th style={{ padding: "12px 16px", color: "#6b7280", fontSize: 13, fontWeight: 500 }}>Name</th>
                <th style={{ padding: "12px 16px", color: "#6b7280", fontSize: 13, fontWeight: 500 }}>Email</th>
                <th style={{ padding: "12px 16px", color: "#6b7280", fontSize: 13, fontWeight: 500 }}>Active Orders</th>
                <th style={{ padding: "12px 16px", color: "#6b7280", fontSize: 13, fontWeight: 500 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {shippers.length === 0 ? (
                <tr>
                  <td colSpan={4} style={{ padding: 24, textAlign: "center", color: "#6b7280" }}>No active shippers found</td>
                </tr>
              ) : (
                shippers.map(shipper => (
                  <tr key={shipper.id} style={{ borderBottom: "1px solid #e5e7eb" }}>
                    <td style={{ padding: "16px", fontSize: 14, fontWeight: 500, color: "#111827" }}>
                      {shipper.firstName} {shipper.lastName}
                    </td>
                    <td style={{ padding: "16px", fontSize: 14, color: "#6b7280" }}>
                      {shipper.email}
                    </td>
                    <td style={{ padding: "16px", fontSize: 14 }}>
                      <span style={{ 
                        background: shipper.activeOrderCount > 0 ? "#dbeafe" : "#f3f4f6", 
                        color: shipper.activeOrderCount > 0 ? "#1e40af" : "#4b5563", 
                        padding: "4px 10px", 
                        borderRadius: 12, 
                        fontSize: 12, 
                        fontWeight: 600 
                      }}>
                        {shipper.activeOrderCount} in flight
                      </span>
                    </td>
                    <td style={{ padding: "16px" }}>
                      <button 
                        onClick={() => setViewingLocationFor(shipper)}
                        style={{ padding: "6px 12px", fontSize: 13, background: "#fff", border: "1px solid #d1d5db", borderRadius: 6, cursor: "pointer", color: "#4b5563" }}
                      >
                        Check Location
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>

      <LocationModal shipper={viewingLocationFor} onClose={() => setViewingLocationFor(null)} />
    </div>
  );
}
