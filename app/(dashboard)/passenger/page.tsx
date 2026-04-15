import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { buses, routes as routesTable, favoriteRoutes, notifications } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import TrackingMap from "@/components/map/MapWrapper";
import ChatInterface from "@/components/chat/ChatInterface";
import PassengerTabs from "@/components/passenger/PassengerTabs";
import { Bus, Bell } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default async function PassengerDashboard() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/sign-in");

  const userId = session.user.id;

  const [activeBuses, activeRoutes, userFavorites, userNotifications] = await Promise.all([
    db.query.buses.findMany({
      where: eq(buses.status, "active"),
      with: { location: true, route: true },
    }),
    db.query.routes.findMany({
      where: eq(routesTable.status, "active"),
      with: { routeStops: { with: { stop: true }, orderBy: (rs, { asc }) => [asc(rs.stopOrder)] } },
    }),
    db.query.favoriteRoutes.findMany({
      where: eq(favoriteRoutes.userId, userId),
      with: { route: true },
    }),
    db.query.notifications.findMany({
      where: eq(notifications.userId, userId),
      orderBy: (n, { desc }) => [desc(n.createdAt)],
      limit: 10,
    }),
  ]);

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

  const unreadCount = userNotifications.filter((n) => !n.read).length;
  const favoriteRouteIds = userFavorites.map((f) => f.routeId);
  const firstName = session.user.name.split(" ")[0];

  return (
    <div className="container mx-auto px-4 py-6 max-w-7xl space-y-6">
      {/* ── Page Header ─────────────────────────────── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Good {getTimeOfDay()}, {firstName}
          </h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            {activeBuses.length} buses active · {activeRoutes.length} routes running
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {unreadCount > 0 && (
            <Badge variant="destructive" className="gap-1">
              <Bell className="h-3 w-3" />
              {unreadCount} new
            </Badge>
          )}
          <div className="flex items-center gap-1.5 bg-emerald-500/10 text-emerald-600 border border-emerald-200 rounded-full px-2.5 py-1 text-xs font-medium">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Live
          </div>
        </div>
      </div>

      {/* ── Quick Stats ──────────────────────────────── */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Active Buses", value: activeBuses.length, icon: Bus, color: "text-cyan-400", bg: "bg-gradient-to-br from-cyan-500/10 to-transparent", border: "border-cyan-500/20" },
          { label: "Routes", value: activeRoutes.length, icon: null, color: "text-purple-400", bg: "bg-gradient-to-br from-purple-500/10 to-transparent", border: "border-purple-500/20" },
          { label: "Saved Routes", value: userFavorites.length, icon: null, color: "text-rose-400", bg: "bg-gradient-to-br from-rose-500/10 to-transparent", border: "border-rose-500/20" },
        ].map(({ label, value, color, bg, border }) => (
          <div key={label} className={`group relative overflow-hidden rounded-2xl border ${border} ${bg} p-5 transition-all hover:bg-opacity-50 hover:shadow-lg hover:shadow-${color.split('-')[1]}-500/10`}>
            <div className="absolute inset-0 bg-white/5 opacity-0 backdrop-blur-3xl transition-opacity group-hover:opacity-100" />
            <div className="relative z-10">
              <p className={`text-4xl font-extrabold tabular-nums tracking-tight ${color} drop-shadow-md`}>{value}</p>
              <p className="text-sm font-medium text-white/70 mt-1 uppercase tracking-wider">{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Main Tabs ────────────────────────────────── */}
      <PassengerTabs
        userId={userId}
        initialBuses={initialBuses}
        activeBuses={activeBuses as any}
        activeRoutes={activeRoutes as any}
        favoriteRouteIds={favoriteRouteIds}
      />
    </div>
  );
}

function getTimeOfDay(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "morning";
  if (hour < 17) return "afternoon";
  return "evening";
}
