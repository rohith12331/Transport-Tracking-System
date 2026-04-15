"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { getPusherClient, CHANNELS, EVENTS } from "@/lib/pusher";
import {
  BusIcon, MapPin, Navigation, Clock, AlertTriangle, CheckCircle,
  XCircle, Flag, Gauge, Radio, ChevronRight, Zap, Users, TrendingUp, Activity
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useSession } from "@/lib/auth-client";

const TrackingMap = dynamic(() => import("@/components/map/TrackingMap"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-muted/30">
      <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  ),
});

interface RouteRecommendation {
  recommendationId: string;
  reason: string;
  timeSavedMinutes: number;
  priority: number;
  expiresAt: string;
}

interface NextStop {
  name: string;
  minutesAway: number;
  confidence: number;
}

export default function DriverDashboard() {
  const [busData, setBusData] = useState<any>(null);
  const [routes, setRoutes] = useState<any[]>([]);
  const [recommendation, setRecommendation] = useState<RouteRecommendation | null>(null);
  const [nextStops, setNextStops] = useState<NextStop[]>([]);
  const [speed, setSpeed] = useState(0);
  const [displaySpeed, setDisplaySpeed] = useState(0);

  const isMissionActive = busData?.status === "active";

  // Smooth Speed Animation
  useEffect(() => {
    const duration = 2000; // 2 seconds to reach the next speed
    const steps = 60;
    const increment = (speed - displaySpeed) / steps;
    let currentStep = 0;

    const timer = setInterval(() => {
      if (currentStep < steps) {
        setDisplaySpeed(prev => Math.round(prev + increment));
        currentStep++;
      } else {
        setDisplaySpeed(speed);
        clearInterval(timer);
      }
    }, duration / steps);

    return () => clearInterval(timer);
  }, [speed]);
  const [issueTitle, setIssueTitle] = useState("");
  const [issueDesc, setIssueDesc] = useState("");
  const [issueLoading, setIssueLoading] = useState(false);
  const [issuePriority, setIssuePriority] = useState<"low" | "medium" | "high" | "critical">("medium");

  const { data: session } = useSession();

  useEffect(() => {
    fetch("/api/routes").then((r) => r.json()).then(setRoutes).catch(() => {});
    
    fetch("/api/buses")
      .then((r) => r.json())
      .then((buses: any[]) => {
        // Strict Assignment Logic:
        // Match ONLY by Driver ID or Driver Name exactly as assigned by Admin
        const assignedBus = buses.find((b) => 
          b.driverId === session?.user?.id || 
          (b.manualDriverName && b.manualDriverName.toLowerCase() === session?.user?.name?.toLowerCase())
        );
        
        if (assignedBus) {
          setBusData(assignedBus);
          // If the bus has a route but it's not starting at the current stop, reset it
          if (!assignedBus.location) {
             fetch("/api/simulator", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ busId: assignedBus.id }),
            });
          }
        }
      })
      .catch(() => {});
  }, [session?.user?.id]);

  useEffect(() => {
    if (!busData?.id) return;

    const pusher = getPusherClient();
    const channel = pusher.subscribe(CHANNELS.bus(busData.id));

    channel.bind(EVENTS.ROUTE_RECOMMENDATION, (data: RouteRecommendation) => {
      setRecommendation(data);
      toast.warning("Route recommendation received!", {
        description: `Save ${data.timeSavedMinutes} min by taking an alternate route.`,
      });
      setTimeout(() => {
        setRecommendation((prev) =>
          prev?.recommendationId === data.recommendationId ? null : prev
        );
      }, new Date(data.expiresAt).getTime() - Date.now());
    });

    const trackChannel = pusher.subscribe(CHANNELS.BUS_TRACKING);
    trackChannel.bind(EVENTS.LOCATION_UPDATE, (data: any) => {
      if (data.busId === busData.id) setSpeed(Math.round(data.speed));
    });

    const fetchETAs = () => {
      fetch(`/api/eta?busId=${busData.id}`)
        .then((r) => r.json())
        .then((etas: any[]) => {
          if (Array.isArray(etas)) {
            setNextStops(
              etas.map((e) => ({
                name: e.stopName,
                minutesAway: e.minutesAway,
                confidence: e.confidence,
                isPassed: e.isPassed,
                arrivalTime: e.arrivalTime,
              }))
            );
          }
        })
        .catch(() => {});
    };

    fetchETAs();
    const interval = setInterval(fetchETAs, 30000); // Update every 30 seconds

    // Constant Cruise Speed Generation (for stability)
    const cruiseInterval = setInterval(() => {
      if (isMissionActive) {
        setSpeed(Math.floor(Math.random() * (70 - 45 + 1)) + 45);
      }
    }, 15000);

    return () => {
      pusher.unsubscribe(CHANNELS.bus(busData.id));
      pusher.unsubscribe(CHANNELS.BUS_TRACKING);
      clearInterval(interval);
      clearInterval(cruiseInterval);
    };
  }, [busData?.id, isMissionActive]);

  async function handleRecommendation(accept: boolean) {
    if (!recommendation) return;
    await fetch("/api/recommendations", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: recommendation.recommendationId,
        status: accept ? "accepted" : "rejected",
        busId: busData?.id,
      }),
    });
    setRecommendation(null);
    toast.success(accept ? "Route updated — passengers notified." : "Keeping current route.");
  }

  const occupancyPercentage = busData ? Math.round((42 / (busData.capacity || 52)) * 100) : 0;
  const [showFullRoute, setShowFullRoute] = useState(false);
  const [missionStartTime, setMissionStartTime] = useState<Date | null>(null);
  const [elapsedTime, setElapsedTime] = useState("00:00:00");

  // Recover mission start time ONCE on mount or when bus transitions to active
  useEffect(() => {
    if (isMissionActive && busData?.id && !missionStartTime) {
      const savedStart = localStorage.getItem(`mission_start_${busData.id}`);
      if (savedStart) {
        setMissionStartTime(new Date(savedStart));
      } else {
        // Use the bus's own updatedAt as the source of truth if active but no local storage
        const fallback = new Date(busData.updatedAt || Date.now());
        setMissionStartTime(fallback);
        localStorage.setItem(`mission_start_${busData.id}`, fallback.toISOString());
      }
    } else if (!isMissionActive) {
      setMissionStartTime(null);
      setElapsedTime("00:00:00");
    }
  }, [isMissionActive, busData?.id]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isMissionActive && missionStartTime) {
      interval = setInterval(() => {
        const diff = Math.floor((Date.now() - missionStartTime.getTime()) / 1000);
        if (diff < 0) return; // Prevent negative time if clocks are out of sync
        const h = Math.floor(diff / 3600).toString().padStart(2, "0");
        const m = Math.floor((diff % 3600) / 60).toString().padStart(2, "0");
        const s = (diff % 60).toString().padStart(2, "0");
        setElapsedTime(`${h}:${m}:${s}`);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isMissionActive, missionStartTime]);

  async function toggleMission() {
    if (!busData?.id) {
      toast.error("Vehicle Identification Failure", {
        description: "No bus is assigned to your account. Please contact dispatch."
      });
      return;
    }
    const newStatus = isMissionActive ? "inactive" : "active";
    
    try {
      const res = await fetch(`/api/buses/${busData.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      
      const data = await res.json();
      if (res.ok) {
        // Reset simulator to start of route (Both starting and stopping resets to beginning)
        fetch("/api/simulator", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ busId: busData.id }),
        });

        setBusData(data);
        if (newStatus === "active") {
          const now = new Date();
          setMissionStartTime(now);
          localStorage.setItem(`mission_start_${busData.id}`, now.toISOString());
          toast.success("Mission Signal Active", {
            description: "GPS broadcasting. Passengers have been notified."
          });
        } else {
          setMissionStartTime(null);
          localStorage.removeItem(`mission_start_${busData.id}`);
          toast.info("Mission Terminated", {
            description: "Vehicle status set to standby."
          });
        }
      } else {
        throw new Error(data.error || "Update failed");
      }
    } catch (err: any) {
      toast.error("Console Sync Failed", {
        description: err.message || "Please check your network connection."
      });
    }
  }

  // Auto-Simulation Loop (Local Dev Support)
  useEffect(() => {
    let simInterval: NodeJS.Timeout;
    if (isMissionActive && busData?.id) {
      simInterval = setInterval(async () => {
        try {
          const res = await fetch("/api/simulator", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ busId: busData.id }),
          });
          const data = await res.json();
          if (data.success) {
            // Re-fetch bus data to update the map marker and speed indicator
            const busRes = await fetch(`/api/buses/${busData.id}`);
            const updated = await busRes.json();
            setBusData(updated);
            
            // Explicitly sync the speed state from the location update
            if (updated.location) {
              setSpeed(Math.round(updated.location.speed));
            }
          }
        } catch (err) {
          console.error("Simulation tick failed:", err);
        }
      }, 5000); // Sync with simulator's 5s update window
    }
    return () => clearInterval(simInterval);
  }, [isMissionActive, busData?.id]);


  async function submitIssue(e: React.FormEvent) {
    e.preventDefault();
    setIssueLoading(true);
    try {
      await fetch("/api/issues", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: issueTitle,
          description: issueDesc,
          busId: busData?.id,
          priority: issuePriority,
        }),
      });
      toast.success("Issue reported — admin has been notified.");
      setIssueTitle("");
      setIssueDesc("");
      setIssuePriority("medium");
    } catch {
      toast.error("Failed to submit issue.");
    } finally {
      setIssueLoading(false);
    }
  }

  const initialBuses = busData?.location
    ? [{
        busId: busData.id,
        busNumber: busData.number,
        routeId: busData.currentRouteId ?? "",
        routeColor: busData.route?.color ?? "#3B82F6",
        latitude: busData.location.latitude,
        longitude: busData.location.longitude,
        speed: busData.location.speed,
        heading: busData.location.heading,
      }]
    : [];

  const sortedStops = busData?.route?.routeStops
    ? [...busData.route.routeStops].sort((a: any, b: any) => a.stopOrder - b.stopOrder)
    : [];

  return (
    <div className="container mx-auto px-4 py-6 max-w-[1600px] space-y-6">
      {/* ── Top Command Bar ─────────────────────────── */}
      <div className="flex items-center justify-between gap-4 bg-card/40 backdrop-blur-xl border border-white/5 rounded-2xl p-4 shadow-2xl">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-emerald-500/20 rounded-xl flex items-center justify-center border border-emerald-500/30">
            <BusIcon className="h-6 w-6 text-emerald-400" />
          </div>
          <div>
            <h1 className="text-xl font-black bg-gradient-to-r from-foreground to-foreground/60 bg-clip-text text-transparent">Driver Console</h1>
            <p className="text-xs text-muted-foreground font-bold uppercase tracking-widest leading-none mt-1">
              {busData ? (
                <>
                  <span className="text-emerald-400">{busData.number}</span>
                  <span className="mx-2 text-white/20">·</span> 
                  <span className={cn(!busData.currentRouteId ? "text-amber-400/60" : "text-white/60")}>
                    {busData.route?.name || (nextStops.length > 0 
                      ? `${nextStops[0].name} → ${nextStops[nextStops.length - 1].name}` 
                      : busData.currentRouteId || "No Route Assigned")}
                  </span>
                </>
              ) : "Standby Mode"}
            </p>
          </div>
        </div>

        <div className="hidden md:flex items-center gap-8">
          <div className="text-center">
            <p className="text-[10px] text-white/40 uppercase font-black tracking-widest mb-1">Speed</p>
            <div className="flex items-baseline gap-1">
              <span className="text-3xl font-black tabular-nums text-foreground leading-none">
                {speed > 0 ? speed : displaySpeed}
              </span>
              <span className="text-xs text-orange-400 font-bold uppercase">km/h</span>
            </div>
          </div>
          
          <div className="w-px h-10 bg-white/5" />

          <div className="text-center min-w-32">
            <p className="text-[10px] text-white/40 uppercase font-black tracking-widest mb-1">Occupancy</p>
            <div className="flex items-center gap-2">
              <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden w-24">
                <div 
                  className="h-full bg-emerald-500 transition-all duration-1000" 
                  style={{ width: `${occupancyPercentage}%` }} 
                />
              </div>
              <span className="text-sm font-bold tabular-nums text-white">{occupancyPercentage}%</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-6">
          <div className="text-center">
            <p className="text-[10px] text-white/40 uppercase font-black tracking-widest mb-1">Mission Clock</p>
            <div className={cn(
              "text-2xl font-black tabular-nums transition-all duration-500",
              isMissionActive ? "text-orange-500 drop-shadow-[0_0_12px_rgba(251,146,60,0.4)]" : "text-muted-foreground"
            )}>
              {elapsedTime}
            </div>
          </div>

          <Button 
            onClick={toggleMission}
            className={cn(
              "h-14 px-8 rounded-2xl font-black text-sm uppercase tracking-widest transition-all duration-500 group",
              isMissionActive 
                ? "bg-gradient-to-br from-rose-500 to-rose-600 hover:from-rose-600 hover:to-rose-700 text-white shadow-[0_0_20px_rgba(244,63,94,0.3)]" 
                : "bg-gradient-to-br from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white shadow-[0_0_20px_rgba(249,115,22,0.3)]"
            )}
          >
            {isMissionActive ? (
              <span className="flex items-center gap-2">
                <XCircle className="w-5 h-5 group-hover:rotate-90 transition-transform" />
                Stop Ride
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <Zap className="w-5 h-5 animate-pulse" />
                Start Mission
              </span>
            )}
          </Button>

          <div className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-xs font-bold">
            DR
          </div>
        </div>
      </div>

      {/* ── Main Content Grid ─────────────────────── */}
      <div className="grid lg:grid-cols-12 gap-6 items-start">
        
        {/* Left: Navigation & Active Alerts (8/12) */}
        <div className="lg:col-span-8 space-y-6">
          
          {/* Active Navigation Card */}
          <Card className="overflow-hidden border-white/10 bg-black/40 backdrop-blur-3xl shadow-2xl relative group">
            <div className="absolute top-4 right-4 z-10 flex gap-2">
              <button 
                onClick={() => setShowFullRoute(!showFullRoute)}
                className={cn(
                  "backdrop-blur-md border rounded-lg px-3 py-2 text-xs font-black transition-all shadow-xl flex items-center gap-2",
                  showFullRoute 
                    ? "bg-orange-500 border-orange-400 text-white" 
                    : "bg-background/80 border-border text-foreground hover:bg-muted"
                )}
              >
                <MapPin className={cn("h-3.5 w-3.5", showFullRoute ? "text-white" : "text-emerald-400")} />
                {showFullRoute ? "SHOWING FULL ROUTE" : (nextStops[0]?.name || "Tracking...")}
              </button>
            </div>

            <div className="h-[calc(100vh-350px)] min-h-[500px]">
              <TrackingMap
                routes={busData?.route ? [busData.route as any] : []}
                initialBuses={initialBuses}
                selectedBusId={busData?.id}
                fitToRoute={showFullRoute}
              />
            </div>

            {/* AI Recommendation Overlay */}
            {recommendation && (
              <div className="absolute inset-x-4 bottom-4 z-20 bg-emerald-500/90 backdrop-blur-2xl border border-emerald-400/50 rounded-2xl p-5 shadow-2xl animate-in slide-in-from-bottom-5">
                <div className="flex items-start justify-between">
                  <div className="flex gap-4">
                    <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center border border-white/30 shrink-0">
                      <Zap className="h-6 w-6 text-white" />
                    </div>
                    <div>
                      <h4 className="text-white font-black uppercase tracking-widest text-sm mb-1">AI Optimization Recommended</h4>
                      <p className="text-white/90 text-sm font-medium leading-snug max-w-lg">
                        {recommendation.reason} Take detour to save <span className="underline decoration-2 underline-offset-4">{recommendation.timeSavedMinutes} minutes</span>.
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button 
                      variant="outline" 
                      className="bg-white/10 border-white/30 text-white hover:bg-white/20 h-11 px-6 uppercase font-black text-xs tracking-widest"
                      onClick={() => handleRecommendation(false)}
                    >
                      Decline
                    </Button>
                    <Button 
                      className="bg-orange-500 hover:bg-orange-600 text-white h-11 px-8 uppercase font-black text-xs tracking-widest shadow-xl border-none"
                      onClick={() => handleRecommendation(true)}
                    >
                      Accept New Route
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </Card>

          {/* Bus Stats Cards for Mobile/Tablet */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 lg:hidden">
            {[
              { label: "Current Speed", value: `${speed} KM/H`, icon: Gauge, color: "text-orange-400" },
              { label: "Occupancy", value: "42/52", icon: Users, color: "text-emerald-400" },
              { label: "Next Stop", value: nextStops.find(s => !(s as any).isPassed)?.name || "...", icon: MapPin, color: "text-primary" },
              { label: "Fuel Level", value: "84%", icon: Activity, color: "text-amber-400" },
            ].map((stat) => (
              <div key={stat.label} className="premium-card p-4">
                <stat.icon className={`h-4 w-4 ${stat.color} mb-2`} />
                <p className="text-[10px] text-white/40 uppercase font-black tracking-widest">{stat.label}</p>
                <p className="text-lg font-black">{stat.value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Right: Operations Sidebar (4/12) */}
        <div className="lg:col-span-4 space-y-6">
          
          {/* Upcoming Stops Timeline */}
          <Card className="flex flex-col h-[400px]">
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <CardTitle className="text-xs font-black uppercase tracking-widest text-white/50">Upcoming Timeline</CardTitle>
              <Badge variant="outline" className="border-emerald-500/20 text-emerald-400 bg-emerald-500/5">{nextStops.length} STOPS</Badge>
            </CardHeader>
            <CardContent className="flex-1 p-0 overflow-hidden">
              <ScrollArea className="h-full px-6 pb-6">
                <div className="relative pt-2">
                  <div className="absolute left-[15px] top-6 bottom-6 w-0.5 bg-border" />
                  <div className="space-y-8">
                    {nextStops.length > 0 ? nextStops.map((stop, i) => {
                      const isArrived = (stop as any).isPassed || stop.minutesAway < 1;
                      const isNextTarget = !isArrived && (i === 0 || (nextStops[i-1] as any).isPassed || nextStops[i-1]?.minutesAway < 1);
                      const distance = i * 24.5; // Mock distance for each leg
                      const abbr = stop.name.substring(0, 3).toUpperCase();
                      
                      return (
                        <div key={i} className="relative flex items-start gap-6 group py-2">
                          {/* Left: Code & Distance */}
                          <div className="w-16 text-right pt-1 shrink-0">
                            <p className="text-xs font-black text-white/80 tracking-widest">{abbr}</p>
                            <p className="text-[9px] text-white/30 font-bold tabular-nums">{distance.toFixed(1)} km</p>
                          </div>

                          {/* Middle: Dot & Tracker */}
                          <div className="relative flex flex-col items-center pt-2">
                            <div className={cn(
                              "w-3.5 h-3.5 rounded-full z-10 border-2 transition-all duration-700",
                              isArrived 
                                ? "bg-emerald-500 border-emerald-400/50 shadow-[0_0_8px_rgba(16,185,129,0.3)]" 
                                : isNextTarget
                                  ? "bg-orange-500 border-orange-400 shadow-[0_0_12px_rgba(249,115,22,0.5)] animate-pulse scale-125"
                                  : "bg-zinc-800 border-white/5"
                            )} />
                            {i < nextStops.length - 1 && (
                              <div className={cn(
                                "absolute top-5 bottom-[-24px] w-0.5",
                                isArrived ? "bg-emerald-500/30" : "bg-white/5"
                              )} />
                            )}
                          </div>

                          {/* Right: Info */}
                          <div className="flex-1 min-w-0 pt-0.5">
                            <h4 className={cn(
                              "text-sm font-black tracking-tight truncate mb-0.5",
                              isArrived ? "text-emerald-400" : isNextTarget ? "text-orange-400" : "text-white/90"
                            )}>
                              {stop.name}
                            </h4>
                            
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                              <div className="flex items-center gap-1.5 text-[10px] uppercase font-black tracking-widest text-white/40">
                                <Clock className="h-3 w-3" />
                                {isArrived ? (
                                  <span className="text-emerald-500/60 italic font-medium lowercase">arrived</span>
                                ) : (
                                  <>
                                    <span>{stop.minutesAway}m</span>
                                    <span className="text-white/10">·</span>
                                    <span className="text-white/70">
                                      {(() => {
                                        const d = new Date((stop as any).arrivalTime);
                                        return isNaN(d.getTime()) ? "--:--" : d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
                                      })()}
                                    </span>
                                  </>
                                )}
                              </div>
                              
                              {isNextTarget && (
                                <Badge variant="outline" className="h-4 px-1 text-[8px] bg-orange-500/10 border-orange-500/20 text-orange-400 font-black tracking-tighter">
                                  ON TIME
                                </Badge>
                              )}
                              
                              <p className="text-[9px] text-white/20 font-bold">Platform #1</p>
                            </div>
                          </div>
                        </div>
                      );
                    }) : (
                      <div className="text-center py-20">
                        <MapPin className="h-8 w-8 mx-auto mb-3 text-white/10" />
                        <p className="text-xs font-black text-white/30 tracking-widest uppercase">No Live Data</p>
                      </div>
                    )}
                  </div>
                </div>
              </ScrollArea>
            </CardContent>
          </Card>

          {/* Quick Controls & Reporting */}
          <Tabs defaultValue="report" className="w-full">
            <TabsList className="grid grid-cols-2 w-full mb-4">
              <TabsTrigger value="report" className="text-[10px] font-black uppercase tracking-widest gap-2">
                <AlertTriangle className="h-3.5 w-3.5" /> Report Issue
              </TabsTrigger>
              <TabsTrigger value="analytics" className="text-[10px] font-black uppercase tracking-widest gap-2">
                <TrendingUp className="h-3.5 w-3.5" /> Stats
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="report">
              <Card className="border-rose-500/20 bg-rose-500/5">
                <CardContent className="pt-6">
                  <form onSubmit={submitIssue} className="space-y-4">
                    <div className="space-y-1">
                      <Label htmlFor="issue-title" className="text-[10px] font-black uppercase tracking-widest text-white/40">Quick Report Title</Label>
                      <Input
                        id="issue-title"
                        placeholder="e.g. Traffic Congestion"
                        value={issueTitle}
                        onChange={(e) => setIssueTitle(e.target.value)}
                        required
                        className="bg-black/20 border-white/10 h-10 text-sm font-bold"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] font-black uppercase tracking-widest text-white/40">Severity</Label>
                      <div className="grid grid-cols-4 gap-1">
                        {(["low", "medium", "high", "critical"] as const).map((p) => (
                          <button
                            key={p}
                            type="button"
                            onClick={() => setIssuePriority(p)}
                            className={cn(
                              "h-8 rounded border text-[9px] font-black uppercase tracking-widest transition-all",
                              issuePriority === p
                                ? p === "low" ? "bg-slate-500/50 border-slate-400 text-white"
                                  : p === "medium" ? "bg-amber-500/50 border-amber-400 text-white"
                                  : p === "high" ? "bg-orange-500/50 border-orange-400 text-white"
                                  : "bg-rose-500/50 border-rose-400 text-white"
                                : "bg-white/5 border-white/10 text-white/40 hover:bg-white/10"
                            )}
                          >
                            {p}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="issue-desc" className="text-[10px] font-black uppercase tracking-widest text-white/40">Details</Label>
                      <Textarea
                        id="issue-desc"
                        rows={3}
                        placeholder="Briefly explain..."
                        value={issueDesc}
                        onChange={(e) => setIssueDesc(e.target.value)}
                        required
                        className="bg-black/20 border-white/10 text-sm font-medium resize-none shadow-inner"
                      />
                    </div>
                    <Button type="submit" disabled={issueLoading} className="w-full bg-rose-500 hover:bg-rose-600 text-white font-black uppercase tracking-[0.2em] h-12 shadow-lg shadow-rose-500/20">
                      {issueLoading ? "Submitting..." : "Send Report"}
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="analytics">
              <Card>
                <CardContent className="pt-6 space-y-6">
                   <div className="space-y-2">
                    <p className="text-[10px] font-black uppercase tracking-widest text-white/40">Route Completion</p>
                    <div className="flex items-center justify-between">
                      <span className="text-2xl font-black text-white">12/18</span>
                      <span className="text-xs font-bold text-emerald-400">67% PROGRESS</span>
                    </div>
                    <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                      <div className="h-full bg-emerald-500 w-[67%]" />
                    </div>
                  </div>
                  
                  <div className="divider h-px bg-white/5" />
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-widest text-white/40 mb-1">Stops Logged</p>
                      <p className="text-xl font-black text-white">142</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-widest text-white/40 mb-1">Eco Score</p>
                      <p className="text-xl font-black text-emerald-400">92/100</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
          
        </div>
      </div>
    </div>
  );
}
