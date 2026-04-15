import "dotenv/config";
import { db } from '../lib/db';
import { busStops, routes, routeStops } from '../lib/db/schema';

async function run() {
  const allRoutes = await db.query.routes.findMany({
    with: {
      routeStops: {
        with: {
          stop: true
        }
      }
    }
  });

  console.log(JSON.stringify(allRoutes, null, 2));
  process.exit(0);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
