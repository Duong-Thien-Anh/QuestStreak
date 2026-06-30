import "dotenv/config";
import postgres from "postgres";
import { resolveDatabaseUrl } from "./_db-url.mjs";

const databaseUrl = resolveDatabaseUrl();
const sql = postgres(databaseUrl, { max: 1 });

try {
  await sql`
    ALTER TABLE public."tasks"
      ADD COLUMN IF NOT EXISTS "startDate" timestamp
  `;
  console.log("✓ tasks.startDate column ensured");
} finally {
  await sql.end();
}
