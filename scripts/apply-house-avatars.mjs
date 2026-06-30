import "dotenv/config";
import postgres from "postgres";
import { resolveDatabaseUrl } from "./_db-url.mjs";

const sql = postgres(resolveDatabaseUrl(), { max: 1 });

try {
  await sql`
    CREATE TABLE IF NOT EXISTS public."houseAvatars" (
      "id" serial PRIMARY KEY,
      "houseId" bigint NOT NULL,
      "url" text NOT NULL,
      "label" varchar(100),
      "addedBy" bigint NOT NULL,
      "createdAt" timestamp NOT NULL DEFAULT now()
    )
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS "house_avatars_house_idx"
    ON public."houseAvatars" ("houseId")
  `;
  console.log("✓ houseAvatars table ensured");
} finally {
  await sql.end();
}
