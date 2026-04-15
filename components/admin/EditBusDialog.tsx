"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Settings, Loader2, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";

interface Route { id: string; name: string; color: string; }

interface Bus {
  id: string;
  number: string;
  status: string;
  currentRouteId: string | null;
  manualDriverName: string | null;
  capacity: number;
  busType: string | null;
}

interface Props {
  bus: Bus;
  routes: Route[];
}

const STATUS_OPTIONS = ["active", "inactive", "maintenance"] as const;
const TYPE_OPTIONS   = ["AC", "Non-AC"] as const;

export default function EditBusDialog({ bus, routes }: Props) {
  const router = useRouter();
  const [open, setOpen]           = useState(false);
  const [saving, setSaving]       = useState(false);
  const [deleting, setDeleting]   = useState(false);
  const [status, setStatus]       = useState(bus.status);
  const [routeId, setRouteId]     = useState(bus.currentRouteId ?? "");
  const [driver, setDriver]       = useState(bus.manualDriverName ?? "");
  const [capacity, setCapacity]   = useState(bus.capacity);
  const [busType, setBusType]     = useState(bus.busType ?? "Non-AC");

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch(`/api/buses/${bus.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status,
          currentRouteId: routeId || null,
          manualDriverName: driver || null,
          capacity,
          busType,
        }),
      });
      if (!res.ok) throw new Error();
      toast.success(`Bus ${bus.number} updated.`);
      setOpen(false);
      router.refresh();
    } catch {
      toast.error("Failed to update bus.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!confirm(`Delete bus ${bus.number}? This cannot be undone.`)) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/buses/${bus.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      toast.success(`Bus ${bus.number} deleted.`);
      setOpen(false);
      router.refresh();
    } catch {
      toast.error("Failed to delete bus.");
    } finally {
      setDeleting(false);
    }
  }

  const inputStyle: React.CSSProperties = {
    width: "100%",
    height: "42px",
    background: "#0f172a",
    border: "1px solid #374151",
    borderRadius: "8px",
    color: "#F9FAFB",
    padding: "0 12px",
    fontSize: "14px",
    outline: "none",
  };

  const labelStyle: React.CSSProperties = {
    display: "block",
    fontSize: "11px",
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    color: "#6B7280",
    marginBottom: "6px",
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 transition-colors"
          style={{ cursor: "pointer" }}
          title={`Edit Bus ${bus.number}`}
        >
          <Settings className="h-3.5 w-3.5" />
        </Button>
      </DialogTrigger>

      <DialogContent
        className="max-w-md"
        style={{ background: "#111827", border: "1px solid #374151" }}
      >
        <DialogHeader>
          <DialogTitle style={{ color: "#F9FAFB" }}>
            Edit Bus{" "}
            <span
              className="ml-1 px-2 py-0.5 rounded text-sm font-bold"
              style={{ background: "#1f2937", color: "#6366F1", border: "1px solid #374151" }}
            >
              {bus.number}
            </span>
          </DialogTitle>
          <p className="text-sm" style={{ color: "#9CA3AF" }}>
            Change route, status, driver and type
          </p>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          {/* Status */}
          <div>
            <label style={labelStyle}>Status</label>
            <div className="grid grid-cols-3 gap-2">
              {STATUS_OPTIONS.map((s) => {
                const colors: Record<string, { bg: string; border: string; text: string }> = {
                  active:      { bg: "rgba(34,197,94,0.1)",  border: "rgba(34,197,94,0.5)",  text: "#22C55E" },
                  inactive:    { bg: "rgba(107,114,128,0.1)", border: "#374151",              text: "#9CA3AF" },
                  maintenance: { bg: "rgba(245,158,11,0.1)", border: "rgba(245,158,11,0.5)", text: "#F59E0B" },
                };
                const c = colors[s];
                const sel = status === s;
                return (
                  <button
                    key={s}
                    onClick={() => setStatus(s)}
                    className="py-2 rounded-lg text-xs font-bold capitalize transition-all"
                    style={{
                      background: sel ? c.bg : "#0f172a",
                      border: `1px solid ${sel ? c.border : "#374151"}`,
                      color: sel ? c.text : "#6B7280",
                      cursor: "pointer",
                    }}
                  >
                    {s}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Route */}
          <div>
            <label style={labelStyle}>Assigned Route</label>
            <select
              value={routeId}
              onChange={(e) => setRouteId(e.target.value)}
              style={{ ...inputStyle, colorScheme: "dark" }}
            >
              <option value="">— Unassigned —</option>
              {routes.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </div>

          {/* Driver name */}
          <div>
            <label style={labelStyle}>Driver Name</label>
            <input
              type="text"
              placeholder="e.g. Ravi Kumar"
              value={driver}
              onChange={(e) => setDriver(e.target.value)}
              style={inputStyle}
              onFocus={(e) => (e.currentTarget.style.borderColor = "#6366F1")}
              onBlur={(e)  => (e.currentTarget.style.borderColor = "#374151")}
            />
          </div>

          {/* Bus type */}
          <div>
            <label style={labelStyle}>Bus Type</label>
            <div className="grid grid-cols-2 gap-2">
              {TYPE_OPTIONS.map((t) => (
                <button
                  key={t}
                  onClick={() => setBusType(t)}
                  className="py-2 rounded-lg text-xs font-bold transition-all"
                  style={{
                    background: busType === t ? "rgba(99,102,241,0.1)" : "#0f172a",
                    border: `1px solid ${busType === t ? "#6366F1" : "#374151"}`,
                    color: busType === t ? "#6366F1" : "#6B7280",
                    cursor: "pointer",
                  }}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* Capacity */}
          <div>
            <label style={labelStyle}>Capacity (seats)</label>
            <input
              type="number"
              min={10}
              max={80}
              value={capacity}
              onChange={(e) => setCapacity(Number(e.target.value))}
              style={inputStyle}
              onFocus={(e) => (e.currentTarget.style.borderColor = "#6366F1")}
              onBlur={(e)  => (e.currentTarget.style.borderColor = "#374151")}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-4 border-t mt-2" style={{ borderColor: "#374151" }}>
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-lg transition-all"
            style={{
              color: "#EF4444",
              background: "rgba(239,68,68,0.08)",
              border: "1px solid rgba(239,68,68,0.25)",
              cursor: deleting ? "not-allowed" : "pointer",
            }}
          >
            {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
            Delete Bus
          </button>

          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving}
              className="gap-1.5"
              style={{
                background: "linear-gradient(135deg, #6366F1, #A855F7)",
                border: "none",
                color: "#fff",
                cursor: saving ? "not-allowed" : "pointer",
              }}
            >
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              Save Changes
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
