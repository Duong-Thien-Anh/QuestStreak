import { resolveDatabaseUrl } from "./_db-url.mjs";
import postgres from "postgres";

const sql = postgres(resolveDatabaseUrl(), { max: 1 });

try {
  await sql`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'language') THEN
        CREATE TYPE "language" AS ENUM ('en', 'vi');
      END IF;
    END
    $$;
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS "userPreferences" (
      "id" serial PRIMARY KEY,
      "userId" bigint NOT NULL,
      "language" "language" DEFAULT 'vi' NOT NULL,
      "createdAt" timestamp DEFAULT now() NOT NULL,
      "updatedAt" timestamp DEFAULT now() NOT NULL
    )
  `;

  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS "user_preferences_user_idx"
    ON "userPreferences" ("userId")
  `;

  await sql`
    INSERT INTO "userPreferences" ("userId", "language")
    SELECT u."id", 'vi'::"language"
    FROM "users" u
    LEFT JOIN "userPreferences" p ON p."userId" = u."id"
    WHERE p."id" IS NULL
  `;

  console.log("Language schema applied");
} finally {
  await sql.end();
}
