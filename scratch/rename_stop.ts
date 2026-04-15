import "dotenv/config";
import { db } from '../lib/db';
import { busStops, routes, routeStops } from '../lib/db/schema';
import { eq, like } from 'drizzle-orm';

async function run() {
  console.log("Renaming Arundalpet to Vijayawada...");
  
  // 1. Find and Update the stop name
  const updated = await db
    .update(busStops)
    .set({ name: "Vijayawada" })
    .where(like(busStops.name, "%Arundalpet%"))
    .returning();
    
  if (updated.length > 0) {
    console.log(`Updated stop: ${updated[0].id} to ${updated[0].name}`);
    
    // 2. Find routes containing this stop and rename them if they have IDs in notice
    // (Optional: Rename the route itself if needed)
  } else {
    console.log("No stop found with name like Arundalpet");
  }

  process.exit(0);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
