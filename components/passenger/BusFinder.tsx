"use client";

import { useState, useEffect, useCallback } from "react";
import { Search, Bus, ChevronRight, ArrowLeft, CheckCircle2, Gauge, Clock, AlertTriangle, TrendingUp, MapPin } from "lucide-react";

interface RouteInfo {
  id: string;
  number: string;
  name: string;
  color: string;
  routeStops: Array<{
    stopOrder: number;
    stop: { id: string; name: string; latitude: number; longitude: number };
  }>;
}

interface BusInfo {
  id: string;
  number: string;
  status: string;
  route?: { id: string; name: string; color: string; number: string } | null;
  location?: { latitude: number; longitude: number; speed: number; heading: number } | null;
}

interface Props {
  activeRoutes: RouteInfo[];
  activeBuses: BusInfo[];
  externalFrom?: string;
  externalTo?: string;
  onTrackOnMap?: (busId: string) => void;
}

// ── Constants ──────────────────────────────────────────────────────────────
const DEPART_H = 4;
const DEPART_M = 30;
const BASE_SPEED_KMH = 30;

// ── Helpers ────────────────────────────────────────────────────────────────
function toMin(h: number, m: number) { return h * 60 + m; }
function nowMin() { const d = new Date(); return d.getHours() * 60 + d.getMinutes(); }

function fmt(m: number): string {
  const h24 = Math.floor(m / 60) % 24;
  const mn   = Math.floor(m) % 60;
  const ap   = h24 < 12 ? "AM" : "PM";
  const h12  = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${mn.toString().padStart(2, "0")} ${ap}`;
}

function distKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

interface StopSchedule {
  stop: RouteInfo["routeStops"][0]["stop"];
  scheduledMin: number;
  actualMin: number;
  delayMin: number;
  distFromPrev: number;
}

function buildSchedule(stops: RouteInfo["routeStops"], busSpeedKmh: number): StopSchedule[] {
  const sorted = [...stops].sort((a, b) => a.stopOrder - b.stopOrder);
  const speed  = busSpeedKmh > 0 ? busSpeedKmh : BASE_SPEED_KMH;
  const result: StopSchedule[] = [];

  let scheduledCursor = toMin(DEPART_H, DEPART_M);
  let actualCursor    = toMin(DEPART_H, DEPART_M);

  for (let i = 0; i < sorted.length; i++) {
    const cur  = sorted[i].stop;
    const prev = sorted[i - 1]?.stop;
    let km = 0;
    if (prev) {
      km = distKm(prev.latitude, prev.longitude, cur.latitude, cur.longitude);
      if (km < 0.05) km = 3;
    }
    scheduledCursor += prev ? (km / BASE_SPEED_KMH) * 60 : 0;
    actualCursor    += prev ? (km / speed) * 60 : 0;
    result.push({ stop: cur, scheduledMin: scheduledCursor, actualMin: actualCursor, delayMin: actualCursor - scheduledCursor, distFromPrev: km });
  }
  return result;
}

function currentStopIdx(schedule: StopSchedule[]): number {
  const now = nowMin();
  let idx = -1;
  for (let i = 0; i < schedule.length; i++) { if (schedule[i].actualMin <= now) idx = i; }
  return idx;
}

export default function BusFinder({ activeRoutes, activeBuses, externalFrom, externalTo, onTrackOnMap }: Props) {
  const [fromStop, setFromStop] = useState("");
  const [toStop, setToStop] = useState("");
  const [date, setDate] = useState("Today");

  useEffect(() => {
    if (externalFrom !== undefined) setFromStop(externalFrom);
    if (externalTo !== undefined) setToStop(externalTo);
  }, [externalFrom, externalTo]);

  const [routeSearch, setRouteSearch]   = useState("");
  const [selectedBus, setSelectedBus]   = useState<BusInfo | null>(null);
  const [selectedRoute, setSelectedRoute] = useState<RouteInfo | null>(null);
  const [busSpeedForSelected, setBusSpeedForSelected] = useState<number>(BASE_SPEED_KMH);

  useEffect(() => {
    if (!selectedBus) return;
    const poll = async () => {
      try {
        const res = await fetch(`/api/buses/${selectedBus.id}`);
        if (res.ok) {
          const d = await res.json();
          const spd = d?.location?.speed ?? 0;
          setBusSpeedForSelected(spd > 2 ? spd : BASE_SPEED_KMH);
        }
      } catch {}
    };
    poll();
    const id = setInterval(poll, 10_000);
    return () => clearInterval(id);
  }, [selectedBus]);

  const filteredRoutes = activeRoutes.filter((r) => {
    const s = r.routeStops.map(rs => rs.stop.name.toLowerCase());
    const f = fromStop ? s.indexOf(fromStop.toLowerCase()) : -1;
    const t = toStop ? s.indexOf(toStop.toLowerCase()) : -1;
    if (fromStop && toStop) return f !== -1 && t !== -1 && f < t;
    if (fromStop) return f !== -1;
    if (toStop) return t !== -1;
    return routeSearch ? (r.name.toLowerCase().includes(routeSearch.toLowerCase()) || r.number.toLowerCase().includes(routeSearch.toLowerCase())) : true;
  });

  const getBusesForRoute = (id: string) => activeBuses.filter(b => b.route?.id === id);

  if (selectedBus && selectedRoute) {
    const route = selectedRoute;
    const bus = selectedBus;
    const schedule = buildSchedule(route.routeStops, busSpeedForSelected);
    const ci = currentStopIdx(schedule);
    const departed = ci >= 0;
    const delay = departed ? schedule[ci].delayMin : 0;

    return (
      <div className="space-y-4">
        <button 
          onClick={() => { setSelectedBus(null); setSelectedRoute(null); }} 
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium border border-gray-700 text-gray-400 hover:bg-gray-800 transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back
        </button>
        
        <div className="p-4 rounded-xl border border-gray-700 bg-gray-900" style={{ borderLeft: `4px solid ${route.color}` }}>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold" style={{ background: route.color }}>
              {bus.number}
            </div>
            <div className="flex-1 font-bold text-white">{route.name}</div>
            <div className="flex items-center gap-2">
              <button 
                onClick={() => onTrackOnMap?.(bus.id)} 
                className="px-3 py-1 rounded-full text-xs font-bold border border-indigo-500/40 text-indigo-400 bg-indigo-500/10 hover:bg-indigo-500/20"
              >
                <MapPin className="h-3.5 w-3.5 inline mr-1" />Map
              </button>
              <div className="px-3 py-1 rounded-full text-xs font-bold border border-cyan-500/30 text-cyan-400 bg-cyan-500/10">
                <Gauge className="h-3.5 w-3.5 inline mr-1" />{Math.round(busSpeedForSelected)} km/h
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-gray-700 bg-gray-900 overflow-hidden p-5 space-y-4">
          <div className="flex justify-between px-10 text-[10px] uppercase font-bold text-gray-500 mb-2">
            <span>Stop Name</span>
            <span>Scheduled</span>
            <span>Est. Arrival</span>
          </div>
          {schedule.map((s, i) => (
            <div key={s.stop.id} className="flex gap-4">
              <div className="flex flex-col items-center w-6">
                <div 
                  className="w-4 h-4 rounded-full border-2 transition-colors" 
                  style={{ 
                    background: i === ci ? route.color : (i < ci ? "#374151" : "transparent"), 
                    borderColor: i <= ci ? route.color : "#374151" 
                  }} 
                />
                {i < schedule.length - 1 && <div className="w-0.5 flex-1 bg-gray-700" />}
              </div>
              <div className="flex-1 pb-4 flex justify-between text-sm items-center">
                <div className={`flex-1 ${i === ci ? "text-white font-bold" : "text-gray-400"}`}>
                  {s.stop.name}
                  {i === ci && <span className="ml-2 text-[10px] text-emerald-400 animate-pulse">● Currently Near</span>}
                </div>
                <div className="w-24 text-right text-gray-500 font-mono text-xs">{fmt(s.scheduledMin)}</div>
                <div className={`w-24 text-right font-mono font-bold ${s.delayMin > 5 ? "text-amber-400" : "text-white"}`}>
                  {fmt(s.actualMin)}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex justify-between items-center">
        <h3 className="font-bold text-white">Search Results</h3>
        {(fromStop || toStop) && <button onClick={() => { setFromStop(""); setToStop(""); }} className="text-xs font-bold text-red-500">Clear</button>}
      </div>
      <div className="space-y-3">
        {filteredRoutes.map((route) => {
          const buses = getBusesForRoute(route.id);
          const stops = [...route.routeStops].sort((a,b) => a.stopOrder - b.stopOrder);
          const firstBusSpd = buses[0]?.location?.speed ?? BASE_SPEED_KMH;
          const routeSched = buildSchedule(route.routeStops, firstBusSpd);
          
          if (routeSched.length === 0) {
            return (
              <div key={route.id} className="rounded-2xl border border-gray-700 bg-gray-900 p-5 opacity-50">
                <div className="text-sm text-gray-500 italic">No stops configured for {route.name}</div>
              </div>
            );
          }

          const sT = fmt(routeSched[0].scheduledMin);
          const eT = fmt(routeSched[routeSched.length - 1].scheduledMin);
          const dM = Math.round(routeSched[routeSched.length-1].scheduledMin - routeSched[0].scheduledMin);
          const cI = currentStopIdx(routeSched);
          const cS = cI >= 0 ? routeSched[cI].stop.name : null;

          return (
            <div key={route.id} className="rounded-2xl border border-gray-700 bg-gray-900 p-5 flex flex-col md:flex-row gap-6 hover:ring-2 hover:ring-red-500/20">
              <div className="flex gap-4 md:w-1/3">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-black" style={{ background: route.color }}>{route.number}</div>
                <div>
                  <div className="font-bold text-white leading-tight">{route.name}</div>
                  <div className="text-xs text-gray-500 mt-1">{stops.length} Stops</div>
                  <div className={`mt-2 text-[10px] font-bold uppercase ${buses.length > 0 ? "text-emerald-500" : "text-gray-600"}`}>{buses.length > 0 ? "● Live" : "Offline"}</div>
                </div>
              </div>
              <div className="flex-1 flex flex-col justify-center border-dashed border-gray-800 md:border-x px-4">
                <div className="flex justify-between items-center max-w-sm mx-auto w-full text-center">
                  <div><div className="text-lg font-black text-white">{sT}</div><div className="text-[10px] uppercase text-gray-500">Starts</div></div>
                  <div className="flex-1 px-4"><div className="text-[10px] text-gray-600 mb-1">{Math.floor(dM/60)}h {dM%60}m</div><div className="h-[2px] bg-gray-800 w-full" /></div>
                  <div><div className="text-lg font-black text-white">{eT}</div><div className="text-[10px] uppercase text-gray-600">Ends</div></div>
                </div>
              </div>
              <div className="md:w-1/4 flex flex-col justify-center items-end gap-3">
                {cS && <div className="text-[10px] font-bold text-emerald-400">Near {cS}</div>}
                {buses.length > 0 ? (
                  <button onClick={() => { setSelectedBus(buses[0]); setSelectedRoute(route); setBusSpeedForSelected(firstBusSpd > 2 ? firstBusSpd : BASE_SPEED_KMH); }} className="px-5 py-2.5 rounded-xl text-xs font-black uppercase bg-red-600 text-white">Track Bus</button>
                ) : (
                  <div className="px-5 py-2.5 rounded-xl text-xs font-black uppercase bg-gray-800 text-gray-600 italic">No Live Bus</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
