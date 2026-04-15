"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { getPusherClient, CHANNELS, EVENTS } from "@/lib/pusher";

mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN!;

interface BusLocation {
  busId: string;
  busNumber: string;
  routeId: string;
  routeColor: string;
  latitude: number;
  longitude: number;
  speed: number;
  heading: number;
}

interface Stop {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
}

interface Route {
  id: string;
  number: string;
  name: string;
  color: string;
  routeStops: Array<{ stop: Stop; stopOrder: number }>;
}

interface TrackingMapProps {
  routes?: Route[];
  initialBuses?: BusLocation[];
  center?: [number, number];
  zoom?: number;
  onBusClick?: (busId: string) => void;
  onStopClick?: (stopId: string) => void;
  selectedBusId?: string | null;
  fitToRoute?: boolean;
}

// ─── Geometry helpers ────────────────────────────────────────────────────────

/** Nearest point on segment [a→b] to point p, all [lng, lat] */
function nearestPointOnSegment(
  p: [number, number],
  a: [number, number],
  b: [number, number]
): [number, number] {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  if (dx === 0 && dy === 0) return a;
  const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy)));
  return [a[0] + t * dx, a[1] + t * dy];
}

/** Snap a [lng, lat] point to the nearest position on a polyline */
function snapToPolyline(lng: number, lat: number, geom: [number, number][]): [number, number] {
  let minDist = Infinity;
  let best: [number, number] = [lng, lat];
  for (let i = 0; i < geom.length - 1; i++) {
    const p = nearestPointOnSegment([lng, lat], geom[i], geom[i + 1]);
    const d = (p[0] - lng) ** 2 + (p[1] - lat) ** 2;
    if (d < minDist) { minDist = d; best = p; }
  }
  return best;
}

// ─── Mapbox Directions API ───────────────────────────────────────────────────

async function fetchRoadGeometry(stops: Stop[], token: string): Promise<[number, number][] | null> {
  if (stops.length < 2) return null;
  const waypoints = stops
    .slice(0, 25)
    .map((s) => `${s.longitude},${s.latitude}`)
    .join(";");
  try {
    const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${waypoints}?geometries=geojson&overview=full&access_token=${token}`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    return (data.routes?.[0]?.geometry?.coordinates as [number, number][]) ?? null;
  } catch {
    return null;
  }
}

// ─── Bus SVG icon ────────────────────────────────────────────────────────────

const BUS_SVG = (color: string) => `
<svg width="34" height="34" viewBox="0 0 34 34" fill="none" xmlns="http://www.w3.org/2000/svg">
  <circle cx="17" cy="17" r="16" fill="${color}" stroke="white" stroke-width="2.5"/>
  <text x="17" y="22" text-anchor="middle" fill="white" font-size="15" font-weight="bold">🚌</text>
</svg>`;

// ─── Component ───────────────────────────────────────────────────────────────

export default function TrackingMap({
  routes = [],
  initialBuses = [],
  center,
  zoom,
  onBusClick,
  onStopClick,
  selectedBusId,
  fitToRoute = false,
}: TrackingMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const busMarkersRef = useRef<Map<string, mapboxgl.Marker>>(new Map());
  const stopMarkersRef = useRef<Map<string, mapboxgl.Marker>>(new Map());
  // Cache road geometry per routeId so bus positions can be snapped
  const routeGeomRef = useRef<Map<string, [number, number][]>>(new Map());
  const [mapLoaded, setMapLoaded] = useState(false);

  const centerLng = center?.[0] ?? parseFloat(process.env.NEXT_PUBLIC_MAP_CENTER_LNG ?? "80.6480");
  const centerLat = center?.[1] ?? parseFloat(process.env.NEXT_PUBLIC_MAP_CENTER_LAT ?? "16.5062");
  const mapZoom = zoom ?? parseFloat(process.env.NEXT_PUBLIC_MAP_ZOOM ?? "14");

  // ── Init map ───────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/mapbox/dark-v11",
      center: [centerLng, centerLat],
      zoom: mapZoom,
    });

    map.current.addControl(new mapboxgl.NavigationControl(), "top-right");
    map.current.on("load", () => setMapLoaded(true));

    return () => {
      map.current?.remove();
      map.current = null;
    };
  }, []);

  // ── Draw road-following routes + stop markers ──────────────────────────────
  useEffect(() => {
    if (!mapLoaded || !map.current) return;
    const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN!;

    routes.forEach(async (route) => {
      const stops = [...route.routeStops]
        .sort((a, b) => a.stopOrder - b.stopOrder)
        .map((rs) => rs.stop);

      if (stops.length < 2) return;

      const sourceId = `route-${route.id}`;

      // Fetch road geometry; fall back to straight lines
      const roadCoords = await fetchRoadGeometry(stops, token);
      const geometry: [number, number][] =
        roadCoords ?? stops.map((s) => [s.longitude, s.latitude]);

      // Cache geometry for bus snapping
      routeGeomRef.current.set(route.id, geometry);

      if (!map.current) return;

      if (!map.current.getSource(sourceId)) {
        map.current.addSource(sourceId, {
          type: "geojson",
          data: { type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: geometry } },
        });

        // White outline underneath for readability
        map.current.addLayer({
          id: `casing-${route.id}`,
          type: "line",
          source: sourceId,
          layout: { "line-join": "round", "line-cap": "round" },
          paint: { "line-color": "#ffffff", "line-width": 9, "line-opacity": 0.85 },
        });

        // Colored route line on top
        map.current.addLayer({
          id: `line-${route.id}`,
          type: "line",
          source: sourceId,
          layout: { "line-join": "round", "line-cap": "round" },
          paint: { "line-color": route.color, "line-width": 5, "line-opacity": 1 },
        });
      }

      // ── Stop markers ──────────────────────────────────────────────────────
      stops.forEach((stop, i) => {
        if (stopMarkersRef.current.has(stop.id)) return;

        const isTerminal = i === 0 || i === stops.length - 1;

        /**
         * KEY FIX: Mapbox GL uses `transform: translate(X,Y)` on the MARKER
         * ELEMENT to position it on screen. Applying scale/other transforms to
         * that element overrides Mapbox's translate and teleports the marker.
         *
         * Solution: `wrapper` is the element Mapbox controls — never touch its
         * transform. `inner` is a child element we control for hover/animation.
         */
        const wrapper = document.createElement("div");
        wrapper.style.cssText = `
          width: ${isTerminal ? 24 : 18}px;
          height: ${isTerminal ? 24 : 18}px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
        `;

        const inner = document.createElement("div");
        inner.style.cssText = `
          width: ${isTerminal ? 16 : 11}px;
          height: ${isTerminal ? 16 : 11}px;
          background: ${isTerminal ? route.color : "#ffffff"};
          border: ${isTerminal ? "3" : "2.5"}px solid ${route.color};
          border-radius: 50%;
          box-shadow: 0 2px 8px rgba(0,0,0,0.4);
          transition: transform 0.15s ease;
          flex-shrink: 0;
        `;
        wrapper.appendChild(inner);

        // Popup for hover — attached to map, not marker, to avoid click toggle
        const popup = new mapboxgl.Popup({
          offset: isTerminal ? 16 : 12,
          closeButton: false,
          closeOnClick: false,
          className: "stop-popup",
        }).setHTML(`
          <div style="font-weight:700;color:${route.color};font-size:13px">
            ${isTerminal && i === 0 ? "● " : isTerminal ? "■ " : ""}${stop.name}
          </div>
          <div style="font-size:11px;color:#666;margin-top:3px">
            Stop ${i + 1} of ${stops.length} · Route ${route.number}
          </div>
        `);

        // Scale inner on hover, show/hide popup
        wrapper.addEventListener("mouseenter", () => {
          inner.style.transform = "scale(1.5)";
          popup.setLngLat([stop.longitude, stop.latitude]).addTo(map.current!);
        });
        wrapper.addEventListener("mouseleave", () => {
          inner.style.transform = "";
          popup.remove();
        });

        wrapper.addEventListener("click", () => onStopClick?.(stop.id));

        const marker = new mapboxgl.Marker({ element: wrapper, anchor: "center" })
          .setLngLat([stop.longitude, stop.latitude])
          .addTo(map.current!);

        stopMarkersRef.current.set(stop.id, marker);
      });
    });
  }, [mapLoaded, routes]);

  // ── Place/update a bus marker, snapping to road geometry ──────────────────
  const updateBusMarker = useCallback(
    (bus: BusLocation) => {
      if (!map.current) return;

      // Snap position to the road geometry for this route
      const geom = routeGeomRef.current.get(bus.routeId);
      const [displayLng, displayLat] = geom
        ? snapToPolyline(bus.longitude, bus.latitude, geom)
        : [bus.longitude, bus.latitude];

      const existing = busMarkersRef.current.get(bus.busId);
      if (existing) {
        // Move marker to snapped road position
        existing.setLngLat([displayLng, displayLat]);

        // Rotate the INNER element (not the wrapper Mapbox controls)
        const inner = existing.getElement().querySelector<HTMLElement>(".bus-inner");
        if (inner) inner.style.transform = `rotate(${bus.heading}deg)`;

        // Update popup content
        const popup = existing.getPopup();
        if (popup) {
          popup.setHTML(`
            <div style="font-weight:700;font-size:13px">Bus ${bus.busNumber}</div>
            <div style="font-size:11px;color:#666;margin-top:3px">🚀 ${Math.round(bus.speed)} km/h</div>
          `);
        }
        return;
      }

      // Create new bus marker — wrapper for Mapbox, inner for our transforms
      const wrapper = document.createElement("div");
      wrapper.style.cssText = `
        width: 38px;
        height: 38px;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        filter: drop-shadow(0 3px 8px rgba(0,0,0,0.45));
      `;

      const inner = document.createElement("div");
      inner.className = "bus-inner";
      inner.innerHTML = BUS_SVG(bus.routeColor || "#3B82F6");
      inner.style.cssText = `
        width: 34px;
        height: 34px;
        transform: rotate(${bus.heading}deg);
        transform-origin: center;
        transition: transform 0.5s ease;
        display: flex;
        align-items: center;
        justify-content: center;
      `;
      wrapper.appendChild(inner);

      wrapper.addEventListener("click", () => onBusClick?.(bus.busId));

      const marker = new mapboxgl.Marker({ element: wrapper, anchor: "center" })
        .setLngLat([displayLng, displayLat])
        .setPopup(
          new mapboxgl.Popup({ offset: 22, closeButton: false }).setHTML(`
            <div style="font-weight:700;font-size:13px">Bus ${bus.busNumber}</div>
            <div style="font-size:11px;color:#666;margin-top:3px">🚀 ${Math.round(bus.speed)} km/h</div>
          `)
        )
        .addTo(map.current);

      busMarkersRef.current.set(bus.busId, marker);
    },
    [onBusClick]
  );

  // ── Render initial buses ───────────────────────────────────────────────────
  useEffect(() => {
    if (!mapLoaded || !map.current) return;
    initialBuses.forEach((bus) => updateBusMarker(bus));
  }, [mapLoaded, initialBuses, updateBusMarker]);

  // ── Pusher real-time updates ───────────────────────────────────────────────
  useEffect(() => {
    const pusher = getPusherClient();
    const channel = pusher.subscribe(CHANNELS.BUS_TRACKING);

    channel.bind(EVENTS.LOCATION_UPDATE, (data: BusLocation) => {
      updateBusMarker(data);
      
      // Auto-follow logic: If this is our selected bus, center map on it
      if (data.busId === selectedBusId && map.current && !fitToRoute) {
        map.current.easeTo({
          center: [data.longitude, data.latitude],
          duration: 1000
        });
      }
    });

    return () => {
      channel.unbind_all();
      pusher.unsubscribe(CHANNELS.BUS_TRACKING);
    };
  }, [updateBusMarker]);

  // ── Highlight selected bus (scale the inner element) ──────────────────────

  
  useEffect(() => {
    busMarkersRef.current.forEach((marker, busId) => {
      const inner = marker.getElement().querySelector<HTMLElement>(".bus-inner");
      if (!inner) return;
      const isSelected = busId === selectedBusId;
      const currentRotate = inner.style.transform.match(/rotate\([^)]+\)/)?.[0] ?? "";
      inner.style.transform = `${currentRotate} scale(${isSelected ? 1.45 : 1})`;
      marker.getElement().style.filter = isSelected
        ? "drop-shadow(0 5px 14px rgba(0,0,0,0.65))"
        : "drop-shadow(0 3px 8px rgba(0,0,0,0.45))";
      marker.getElement().style.zIndex = isSelected ? "10" : "1";
    });
  }, [selectedBusId]);

  useEffect(() => {
    if (!mapLoaded || !map.current) return;
    
    if (fitToRoute && routes.length > 0) {
      const bounds = new mapboxgl.LngLatBounds();
      routes.forEach(route => {
        const geom = routeGeomRef.current.get(route.id);
        if (geom) {
          geom.forEach(coord => bounds.extend(coord));
        } else {
          route.routeStops.forEach(rs => bounds.extend([rs.stop.longitude, rs.stop.latitude]));
        }
      });
      
      if (!bounds.isEmpty()) {
        map.current.fitBounds(bounds, { padding: 80, duration: 1500 });
      }
    } else if (selectedBusId) {
      const marker = busMarkersRef.current.get(selectedBusId);
      if (marker) {
        const coords = marker.getLngLat();
        map.current.flyTo({
          center: coords,
          zoom: 16,
          duration: 2000,
          essential: true
        });
      }
    }
  }, [mapLoaded, fitToRoute, selectedBusId, routes]);

  return (
    <div className="relative w-full h-full">
      <div ref={mapContainer} className="w-full h-full" />
      {!mapLoaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-muted/80 backdrop-blur-sm">
          <div className="text-center space-y-3">
            <div className="w-9 h-9 border-[3px] border-primary border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-sm font-medium text-muted-foreground">Loading map…</p>
          </div>
        </div>
      )}
    </div>
  );
}
