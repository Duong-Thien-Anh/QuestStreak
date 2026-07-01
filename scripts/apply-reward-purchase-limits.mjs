import "dotenv/config";
import postgres from "postgres";
import { resolveDatabaseUrl } from "./_db-url.mjs";

const sql = postgres(resolveDatabaseUrl(), { max: 1 });

try {
  await sql`ALTER TABLE public."rewards" ADD COLUMN IF NOT EXISTS "purchaseLimit" integer`;
  await sql`ALTER TABLE public."rewards" ADD COLUMN IF NOT EXISTS "purchaseLimitPerUser" integer`;
  console.log("✓ rewards purchase limit columns ensured");
} finally {
  await sql.end();
}
