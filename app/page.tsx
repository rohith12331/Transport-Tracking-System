import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  MapPin, Clock, Route, Bot, Bus, ArrowRight, Zap,
  Shield, TrendingUp, Navigation, Star, ChevronRight,
  Radio, Users, Activity
} from "lucide-react";
import { db } from "@/lib/db";
import { buses, routes as routesTable } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import TrackingMap from "@/components/map/MapWrapper";
import { ModeToggle } from "@/components/mode-toggle";

async function getPublicData() {
  try {
    const [activeBuses, activeRoutes] = await Promise.all([
      db.query.buses.findMany({
        where: eq(buses.status, "active"),
        with: {
          location: true,
          route: { columns: { id: true, number: true, name: true, color: true } },
        },
      }),
      db.query.routes.findMany({
        where: eq(routesTable.status, "active"),
        with: {
          routeStops: {
            with: { stop: true },
            orderBy: (rs, { asc }) => [asc(rs.stopOrder)],
          },
        },
      }),
    ]);
    return { activeBuses, activeRoutes };
  } catch {
    return { activeBuses: [], activeRoutes: [] };
  }
}

export default async function HomePage() {
  const { activeBuses, activeRoutes } = await getPublicData();

  const initialBuses = activeBuses
    .filter((b) => b.location)
    .map((b) => ({
      busId: b.id,
      busNumber: b.number,
      routeId: b.currentRouteId ?? "",
      routeColor: b.route?.color ?? "#3B82F6",
      latitude: b.location!.latitude,
      longitude: b.location!.longitude,
      speed: b.location!.speed,
      heading: b.location!.heading,
    }));

  const totalStops = activeRoutes.reduce((acc, r) => acc + r.routeStops.length, 0);

  return (
    <div className="min-h-screen bg-background">
      {/* ── Navigation ─────────────────────────────── */}
      <header className="border-b sticky top-0 z-50 bg-background/80 backdrop-blur-xl">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
              <Bus className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="font-bold text-lg tracking-tight">TransitTrack</span>
          </div>
          <nav className="hidden md:flex items-center gap-6 text-sm text-muted-foreground">
            <Link href="#map" className="hover:text-foreground transition-colors">Live Map</Link>
            <Link href="#features" className="hover:text-foreground transition-colors">Features</Link>
            <Link href="#routes" className="hover:text-foreground transition-colors">Routes</Link>
          </nav>
          <div className="flex items-center gap-2">
            <ModeToggle />
            <Link href="/sign-in">
              <Button variant="ghost" size="sm">Sign In</Button>
            </Link>
            <Link href="/sign-up">
              <Button size="sm" className="gap-1.5">
                Get Started <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* ── Hero ───────────────────────────────────── */}
      <section className="relative overflow-hidden">
        {/* Background gradient */}
        <div className="absolute inset-0 bg-linear-to-br from-primary/5 via-background to-background" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-200 h-100 bg-primary/5 rounded-full blur-3xl" />

        <div className="relative container mx-auto px-4 pt-20 pb-16 text-center space-y-6">
          <Badge variant="outline" className="gap-1.5 text-xs px-3 py-1 border-primary/30 text-primary bg-primary/5">
            <Radio className="h-3 w-3 animate-pulse" />
            Live GPS tracking active
          </Badge>

          <h1 className="text-5xl md:text-7xl font-bold tracking-tight leading-none">
            Never miss your
            <br />
            <span className="text-primary">bus again</span>
          </h1>

          <p className="text-lg text-muted-foreground max-w-xl mx-auto leading-relaxed">
            Real-time GPS tracking, AI-powered arrival predictions, and smart route
            recommendations — built for modern cities.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
            <Link href="/sign-up">
              <Button size="lg" className="gap-2 h-12 px-8 text-base">
                Start Tracking Free
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link href="#map">
              <Button size="lg" variant="outline" className="gap-2 h-12 px-8 text-base">
                <Navigation className="h-4 w-4" />
                View Live Map
              </Button>
            </Link>
          </div>

          {/* Live stats */}
          <div className="flex items-center justify-center gap-10 pt-8">
            <div className="text-center">
              <div className="text-3xl font-bold tabular-nums">{activeBuses.length}</div>
              <div className="text-xs text-muted-foreground mt-0.5 uppercase tracking-wide">Active Buses</div>
            </div>
            <div className="w-px h-10 bg-border" />
            <div className="text-center">
              <div className="text-3xl font-bold tabular-nums">{activeRoutes.length}</div>
              <div className="text-xs text-muted-foreground mt-0.5 uppercase tracking-wide">Routes</div>
            </div>
            <div className="w-px h-10 bg-border" />
            <div className="text-center">
              <div className="text-3xl font-bold tabular-nums">{totalStops}</div>
              <div className="text-xs text-muted-foreground mt-0.5 uppercase tracking-wide">Stops</div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Live Map ───────────────────────────────── */}
      <section id="map" className="container mx-auto px-4 pb-20">
        <div className="relative">
          <div className="absolute -inset-1 bg-linear-to-r from-primary/20 via-primary/10 to-primary/20 rounded-2xl blur-sm" />
          <div className="relative rounded-xl overflow-hidden border shadow-2xl h-130">
            <TrackingMap routes={activeRoutes as any} initialBuses={initialBuses} />
            {/* Floating badge */}
            <div className="absolute top-4 left-4 z-10">
              <div className="flex items-center gap-2 bg-background/90 backdrop-blur border rounded-full px-3 py-1.5 text-sm font-medium shadow-lg">
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                Live · {activeBuses.length} buses on map
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Features ───────────────────────────────── */}
      <section id="features" className="py-24 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <Badge variant="outline" className="mb-4 text-xs">Powerful Features</Badge>
            <h2 className="text-4xl font-bold tracking-tight mb-4">
              Everything you need
            </h2>
            <p className="text-muted-foreground max-w-lg mx-auto">
              A complete transit management platform with tools for passengers, drivers, and administrators.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              {
                icon: MapPin,
                title: "Live Tracking",
                desc: "Every bus on the map, updated every 5 seconds via GPS. Never wonder where your bus is.",
                color: "text-emerald-500",
                bg: "bg-emerald-500/10",
              },
              {
                icon: Clock,
                title: "Smart ETAs",
                desc: "AI-powered arrival predictions with confidence scores based on historical data.",
                color: "text-amber-500",
                bg: "bg-amber-500/10",
              },
              {
                icon: Route,
                title: "Route Optimizer",
                desc: "Real-time traffic analysis helps drivers avoid delays and saves passengers time.",
                color: "text-teal-500",
                bg: "bg-teal-500/10",
              },
              {
                icon: Bot,
                title: "AI Assistant",
                desc: "Ask anything about schedules, routes, and arrivals in natural language.",
                color: "text-primary",
                bg: "bg-primary/10",
              },
            ].map(({ icon: Icon, title, desc, color, bg }) => (
              <div
                key={title}
                className="group relative bg-background border rounded-2xl p-6 hover:shadow-md transition-all hover:-translate-y-0.5"
              >
                <div className={`w-10 h-10 ${bg} rounded-xl flex items-center justify-center mb-4`}>
                  <Icon className={`h-5 w-5 ${color}`} />
                </div>
                <h3 className="font-semibold mb-2">{title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>

          {/* Role benefits */}
          <div className="grid md:grid-cols-3 gap-6 mt-12">
            {[
              {
                icon: Users,
                role: "Passengers",
                points: ["Track buses in real-time", "Save favorite routes", "Get arrival alerts", "Ask AI for help"],
                color: "border-emerald-200 bg-emerald-50 dark:bg-emerald-950/20",
                iconColor: "text-emerald-600",
                iconBg: "bg-emerald-100 dark:bg-emerald-900/40",
              },
              {
                icon: Navigation,
                role: "Drivers",
                points: ["Navigation with ETAs", "Route recommendations", "Report incidents", "Live passenger count"],
                color: "border-teal-200 bg-teal-50 dark:bg-teal-950/20",
                iconColor: "text-teal-600",
                iconBg: "bg-teal-100 dark:bg-teal-900/40",
              },
              {
                icon: Shield,
                role: "Administrators",
                points: ["Fleet management", "Live system overview", "Issue resolution", "GPS simulation"],
                color: "border-amber-200 bg-amber-50 dark:bg-amber-950/20",
                iconColor: "text-amber-600",
                iconBg: "bg-amber-100 dark:bg-amber-900/40",
              },
            ].map(({ icon: Icon, role, points, color, iconColor, iconBg }) => (
              <div key={role} className={`rounded-2xl border p-6 ${color}`}>
                <div className={`w-10 h-10 ${iconBg} rounded-xl flex items-center justify-center mb-4`}>
                  <Icon className={`h-5 w-5 ${iconColor}`} />
                </div>
                <h3 className="font-semibold mb-3">For {role}</h3>
                <ul className="space-y-2">
                  {points.map((p) => (
                    <li key={p} className="flex items-center gap-2 text-sm text-muted-foreground">
                      <ChevronRight className={`h-3.5 w-3.5 ${iconColor} shrink-0`} />
                      {p}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Active Routes ──────────────────────────── */}
      {activeRoutes.length > 0 && (
        <section id="routes" className="container mx-auto px-4 py-20">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-3xl font-bold tracking-tight">Active Routes</h2>
              <p className="text-muted-foreground mt-1">Currently operating bus routes</p>
            </div>
            <Badge variant="secondary" className="gap-1">
              <Activity className="h-3 w-3 text-green-500" />
              {activeRoutes.length} active
            </Badge>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {activeRoutes.map((route) => {
              const firstStop = route.routeStops[0]?.stop?.name;
              const lastStop = route.routeStops[route.routeStops.length - 1]?.stop?.name;
              return (
                <div
                  key={route.id}
                  className="group relative bg-background border rounded-xl p-4 hover:shadow-md transition-all hover:-translate-y-0.5 overflow-hidden"
                >
                  <div
                    className="absolute left-0 top-0 bottom-0 w-1 rounded-l-xl"
                    style={{ backgroundColor: route.color }}
                  />
                  <div className="pl-3">
                    <div className="flex items-start justify-between gap-2">
                      <div
                        className="w-9 h-9 rounded-lg flex items-center justify-center text-white font-bold text-xs shrink-0"
                        style={{ backgroundColor: route.color }}
                      >
                        {route.number}
                      </div>
                      <Badge variant="outline" className="text-xs shrink-0">
                        {route.routeStops.length} stops
                      </Badge>
                    </div>
                    <p className="font-semibold mt-2 mb-1">{route.name}</p>
                    {firstStop && lastStop && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <MapPin className="h-3 w-3 shrink-0" />
                        {firstStop} → {lastStop}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* ── CTA ────────────────────────────────────── */}
      <section className="py-24 bg-primary relative overflow-hidden">
        <div className="absolute inset-0 bg-linear-to-br from-primary via-secondary to-primary/80" />
        <div className="absolute top-0 right-0 w-150 h-75 bg-white/10 rounded-full blur-3xl" />
        <div className="relative container mx-auto px-4 text-center space-y-8">
          <h2 className="text-4xl font-bold text-primary-foreground">
            Start tracking today
          </h2>
          <p className="text-primary-foreground/70 max-w-md mx-auto">
            Sign up as a passenger to save favorite routes and get real-time arrival notifications.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link href="/sign-up">
              <Button size="lg" variant="secondary" className="gap-2 h-12 px-8">
                Create Free Account <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link href="/sign-in">
              <Button size="lg" variant="outline" className="gap-2 h-12 px-8 border-primary-foreground/30 text-primary-foreground hover:bg-primary-foreground/10">
                Sign In
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* ── Footer ─────────────────────────────────── */}
      <footer className="border-t py-10 bg-muted/20">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 bg-primary rounded flex items-center justify-center">
                <Bus className="h-3 w-3 text-primary-foreground" />
              </div>
              <span className="font-semibold text-sm">TransitTrack</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Smart city bus tracking system · Real-time GPS · AI-powered
            </p>
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <Link href="/sign-in" className="hover:text-foreground transition-colors">Sign In</Link>
              <Link href="/sign-up" className="hover:text-foreground transition-colors">Register</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
