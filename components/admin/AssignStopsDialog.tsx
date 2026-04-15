"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, ListPlus, Plus, Trash2, ArrowUp, ArrowDown, Check } from "lucide-react";
import { toast } from "sonner";

interface Stop {
  id: string;
  name: string;
}

interface RouteInfo {
  id: string;
  name: string;
  number: string;
  color: string;
}

interface Props {
  routes: RouteInfo[];
  allStops: Stop[];
}

export default function AssignStopsDialog({ routes, allStops }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedRouteId, setSelectedRouteId] = useState("");
  const [orderedStops, setOrderedStops] = useState<Stop[]>([]);

  function toggleStop(stop: Stop) {
    setOrderedStops((prev) => {
      if (prev.find((s) => s.id === stop.id)) {
        return prev.filter((s) => s.id !== stop.id);
      }
      return [...prev, stop];
    });
  }

  function moveUp(idx: number) {
    if (idx === 0) return;
    setOrderedStops((prev) => {
      const next = [...prev];
      [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
      return next;
    });
  }

  function moveDown(idx: number) {
    setOrderedStops((prev) => {
      if (idx === prev.length - 1) return prev;
      const next = [...prev];
      [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
      return next;
    });
  }

  async function handleSave() {
    if (!selectedRouteId) { toast.error("Select a route first."); return; }
    if (orderedStops.length < 2) { toast.error("Select at least 2 stops."); return; }
    setLoading(true);
    try {
      // First clear existing route-stops
      await fetch(`/api/route-stops?routeId=${selectedRouteId}`, { method: "DELETE" });

      // Add each stop in order
      for (let i = 0; i < orderedStops.length; i++) {
        await fetch("/api/route-stops", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            routeId: selectedRouteId,
            stopId: orderedStops[i].id,
            stopOrder: i + 1,
            distanceFromPrev: 0,
            estimatedMinutesFromStart: i * 9,
          }),
        });
      }

      toast.success(`✅ ${orderedStops.length} stops assigned to route!`);
      setOpen(false);
      setOrderedStops([]);
      setSelectedRouteId("");
      router.refresh();
    } catch {
      toast.error("Failed to assign stops.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="gap-1.5">
          <ListPlus className="h-3.5 w-3.5" /> Assign Stops to Route
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col" style={{ background: "#111827", border: "1px solid #374151" }}>
        <DialogHeader>
          <DialogTitle style={{ color: "#F9FAFB" }}>Assign Stops to a Route</DialogTitle>
          <p className="text-sm" style={{ color: "#9CA3AF" }}>Select a route, then pick and order stops</p>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-5 mt-2 pr-1">
          {/* Route selector */}
          <div>
            <label className="text-xs font-bold uppercase tracking-widest block mb-2" style={{ color: "#6B7280" }}>
              1. Select Route
            </label>
            <div className="grid grid-cols-2 gap-2">
              {routes.map((r) => (
                <button
                  key={r.id}
                  onClick={() => setSelectedRouteId(r.id)}
                  className="flex items-center gap-2.5 p-3 rounded-xl text-left transition-all"
                  style={{
                    background: selectedRouteId === r.id ? "rgba(99,102,241,0.1)" : "#0f172a",
                    border: `1px solid ${selectedRouteId === r.id ? "#6366F1" : "#374151"}`,
                    cursor: "pointer",
                  }}
                >
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-xs shrink-0"
                    style={{ background: r.color }}>
                    {r.number}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate" style={{ color: "#F9FAFB" }}>{r.name}</p>
                  </div>
                  {selectedRouteId === r.id && <Check className="h-4 w-4 shrink-0" style={{ color: "#6366F1" }} />}
                </button>
              ))}
            </div>
          </div>

          {/* Stop picker */}
          <div>
            <label className="text-xs font-bold uppercase tracking-widest block mb-2" style={{ color: "#6B7280" }}>
              2. Pick Stops (in order of travel)
            </label>
            <div className="grid grid-cols-2 gap-2 max-h-52 overflow-y-auto pr-1">
              {allStops.map((stop) => {
                const selected = !!orderedStops.find((s) => s.id === stop.id);
                const idx = orderedStops.findIndex((s) => s.id === stop.id);
                return (
                  <button
                    key={stop.id}
                    onClick={() => toggleStop(stop)}
                    className="flex items-center gap-2 p-2.5 rounded-lg text-left transition-all"
                    style={{
                      background: selected ? "rgba(34,197,94,0.08)" : "#0f172a",
                      border: `1px solid ${selected ? "rgba(34,197,94,0.4)" : "#374151"}`,
                      cursor: "pointer",
                    }}
                  >
                    <div
                      className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                      style={{ background: selected ? "#22C55E" : "#1f2937", color: selected ? "#fff" : "#6B7280" }}
                    >
                      {selected ? idx + 1 : <Plus className="h-3 w-3" />}
                    </div>
                    <span className="text-sm truncate" style={{ color: selected ? "#F9FAFB" : "#9CA3AF" }}>{stop.name}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Ordered stop list */}
          {orderedStops.length > 0 && (
            <div>
              <label className="text-xs font-bold uppercase tracking-widest block mb-2" style={{ color: "#6B7280" }}>
                3. Re-order if needed
              </label>
              <div className="space-y-1.5">
                {orderedStops.map((stop, idx) => (
                  <div
                    key={stop.id}
                    className="flex items-center gap-2 p-2.5 rounded-lg"
                    style={{ background: "#0f172a", border: "1px solid #374151" }}
                  >
                    <div
                      className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 text-white"
                      style={{ background: "#6366F1" }}
                    >
                      {idx + 1}
                    </div>
                    <span className="flex-1 text-sm font-medium" style={{ color: "#F9FAFB" }}>{stop.name}</span>
                    <div className="flex items-center gap-1">
                      <button onClick={() => moveUp(idx)} className="p-1 rounded" style={{ color: "#6B7280", cursor: "pointer" }}>
                        <ArrowUp className="h-3.5 w-3.5" />
                      </button>
                      <button onClick={() => moveDown(idx)} className="p-1 rounded" style={{ color: "#6B7280", cursor: "pointer" }}>
                        <ArrowDown className="h-3.5 w-3.5" />
                      </button>
                      <button onClick={() => toggleStop(stop)} className="p-1 rounded" style={{ color: "#EF4444", cursor: "pointer" }}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-4 border-t mt-3" style={{ borderColor: "#374151" }}>
          <p className="text-sm" style={{ color: "#9CA3AF" }}>
            {orderedStops.length} stop{orderedStops.length !== 1 ? "s" : ""} selected
          </p>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button
              onClick={handleSave}
              disabled={loading || !selectedRouteId || orderedStops.length < 2}
              className="premium-btn gap-2"
            >
              {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Save Route Stops
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
