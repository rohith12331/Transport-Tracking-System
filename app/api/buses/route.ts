import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { buses, busLocations } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";

export async function GET() {
  try {
    const allBuses = await db.query.buses.findMany({
      with: {
        route: {
          with: {
            routeStops: {
              with: { stop: true }
            }
          }
        },
        location: true,
        driver: { columns: { id: true, name: true } },
      },
    });
    return NextResponse.json(allBuses);
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch buses" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const id = nanoid();
    const [bus] = await db
      .insert(buses)
      .values({ id, ...body })
      .returning();
    return NextResponse.json(bus, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: "Failed to create bus" }, { status: 500 });
  }
}
