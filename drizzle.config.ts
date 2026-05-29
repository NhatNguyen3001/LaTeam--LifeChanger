import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

config({ path: ".env" });

export default defineConfig({
  schema: "./lib/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  // Direct connection (port 5432) — migrations don't go through the pooler.
  dbCredentials: { url: process.env.DIRECT_URL! },
});
