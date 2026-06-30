import "dotenv/config";
import postgres from "postgres";
import { resolveDatabaseUrl } from "./_db-url.mjs";

const sql = postgres(resolveDatabaseUrl(), { max: 1 });

try {
  await sql`ALTER TABLE public."tasks" ADD COLUMN IF NOT EXISTS "recurringDays" text`;
  console.log("✓ tasks.recurringDays column ensured");
} finally {
  await sql.end();
}
