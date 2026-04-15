import "dotenv/config";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "../lib/db/schema";
import { eq } from "drizzle-orm";
import { auth } from "../lib/auth"; // import the auth instance

async function createAdmin() {
  console.log("Creating Admin User...");

  const email = "sriram@gmail.com";
  const password = "sriram@098";
  const name = "Sriram Admin";

  try {
    // Attempt to create the user directly in the database
    // Better Auth has a backend API to create users directly
    
    // First let's check if the user already exists using db
    const sql = neon(process.env.DATABASE_URL!);
    const db = drizzle(sql, { schema });
    
    const existing = await db.query.users.findFirst({
        where: eq(schema.users.email, email)
    });

    if (existing) {
        console.log("User already exists. Updating role to admin...");
        await db.update(schema.users)
            .set({ role: "admin" })
            .where(eq(schema.users.email, email));
        console.log("Updated role to admin!");
    } else {
        console.log("User does not exist yet. Please manually sign up as a passenger on the website first using the email and password you provided.");
        console.log("Then run this script again to upgrade the account to an admin.");
    }
    
    process.exit(0);
  } catch (error) {
    console.error("Error creating/updating admin:", error);
    process.exit(1);
  }
}

createAdmin();
