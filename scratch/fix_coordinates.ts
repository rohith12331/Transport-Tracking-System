import "dotenv/config";
import { db } from '../lib/db';
import { busStops } from '../lib/db/schema';
import { eq, like } from 'drizzle-orm';

async function run() {
  console.log("Updating Vijayawada coordinates to actually be in Vijayawada...");
  
  // Vijayawada, Andhra Pradesh coordinates
  const LAT = 16.5062;
  const LNG = 80.6480;

  const updated = await db
    .update(busStops)
    .set({ 
      latitude: LAT, 
      longitude: LNG 
    })
    .where(eq(busStops.name, "Vijayawada"))
    .returning();
    
  if (updated.length > 0) {
    console.log(`Updated Vijayawada coordinates: [${LAT}, ${LNG}]`);
  } else {
    console.log("No stop found with name 'Vijayawada'");
  }

  process.exit(0);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
