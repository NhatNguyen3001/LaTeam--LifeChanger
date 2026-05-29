import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is not set");

/** Reuse one pool in dev (HMR) and cap connections for Supabase pooler. */
const globalForDb = globalThis as unknown as {
  pgClient?: ReturnType<typeof postgres>;
};

function createClient() {
  return postgres(url!, {
    prepare: false,
    // Transaction pooler (port 6543): keep low — Supabase free tier ~200 pool slots total.
    max: process.env.NODE_ENV === "production" ? 1 : 3,
    idle_timeout: 20,
    connect_timeout: 15,
  });
}

const client = globalForDb.pgClient ?? createClient();
if (process.env.NODE_ENV !== "production") {
  globalForDb.pgClient = client;
}

export const db = drizzle(client, { schema });
export { schema };
