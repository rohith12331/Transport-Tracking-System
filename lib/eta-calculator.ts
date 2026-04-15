import { db } from "./db";
import { historicalData, busStops, routeStops } from "./db/schema";
import { and, eq, between } from "drizzle-orm";

/** Haversine formula — distance in km between two lat/lng points */
export function haversineDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export interface ETAPrediction {
  stopId: string;
  stopName: string;
  minutesAway: number;
  arrivalTime: string;
  confidence: number;
  isPassed?: boolean;
}

/**
 * Calculate ETAs for all remaining stops on a route.
 */
export async function calculateETAs(params: {
  busId: string;
  routeId: string;
  currentLat: number;
  currentLng: number;
  currentSpeed: number; // km/h
  currentStopIndex: number;
  isReverse?: boolean;
}): Promise<ETAPrediction[]> {
  const { busId, routeId, currentLat, currentLng, currentSpeed, currentStopIndex, isReverse = false } = params;

  // Get remaining stops in order
  const stops = await db.query.routeStops.findMany({
    where: eq(routeStops.routeId, routeId),
    with: { stop: true },
    orderBy: (rs, { asc }) => [asc(rs.stopOrder)],
  });

  // Track all stops from starting to ending
  const allStops = stops.sort((a, b) => (isReverse ? b.stopOrder - a.stopOrder : a.stopOrder - b.stopOrder));
  
  if (allStops.length === 0) return [];

  const now = new Date();
  const hour = now.getHours();
  const day = now.getDay();
  const speed = Math.max(currentSpeed, 10); // minimum 10 km/h to avoid division by 0

  let accumulatedMinutes = 0;
  const predictions: ETAPrediction[] = [];

  let prevLat = currentLat;
  let prevLng = currentLng;

  for (const rs of allStops) {
    const stop = rs.stop;
    const isPassed = isReverse ? rs.stopOrder >= currentStopIndex : rs.stopOrder <= currentStopIndex;
    
    if (isPassed) {
       predictions.push({
        stopId: stop.id,
        stopName: stop.name,
        minutesAway: 0,
        arrivalTime: now.toISOString(),
        confidence: 100,
        isPassed: true
      } as any);
      continue;
    }

    const distance = haversineDistance(prevLat, prevLng, stop.latitude, stop.longitude);

    // Travel time at current speed
    const rawMinutes = (distance / speed) * 60;

    // Query historical average for this segment
    let historicalMinutes: number | null = null;
    let confidence = 60;

    try {
      const history = await db
        .select()
        .from(historicalData)
        .where(
          and(
            eq(historicalData.routeId, routeId),
            eq(historicalData.stopId, stop.id),
            between(historicalData.hourOfDay, Math.max(0, hour - 1), Math.min(23, hour + 1)),
            eq(historicalData.dayOfWeek, day)
          )
        )
        .limit(20);

      if (history.length >= 3) {
        const avgDelay =
          history.reduce((sum, h) => sum + h.delayMinutes, 0) / history.length;
        historicalMinutes = rawMinutes + avgDelay;
        confidence = Math.min(95, 60 + history.length * 2);
      }
    } catch {
      // Fallback to raw calculation
    }

    const travelMinutes = historicalMinutes ?? rawMinutes;
    const dwellTime = 0.5; // 30-second stop dwell
    accumulatedMinutes += travelMinutes + dwellTime;

    const predictedArrival = new Date(now.getTime() + accumulatedMinutes * 60 * 1000);

    predictions.push({
      stopId: stop.id,
      stopName: stop.name,
      minutesAway: Math.round(accumulatedMinutes),
      arrivalTime: predictedArrival.toISOString(),
      confidence,
    });

    prevLat = stop.latitude;
    prevLng = stop.longitude;
  }

  return predictions;
}
