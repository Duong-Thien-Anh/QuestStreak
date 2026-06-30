// Run: node --env-file=.env scripts/repair-user-credentials-schema.mjs
import { resolveDatabaseUrl } from "./_db-url.mjs";
import postgres from "postgres";

const sql = postgres(resolveDatabaseUrl(), { max: 1 });

try {
  await sql`
    CREATE TABLE IF NOT EXISTS "userCredentials" (
      "id" serial PRIMARY KEY,
      "userId" bigint NOT NULL,
      "email" varchar(320) NOT NULL,
      "username" varchar(100),
      "phone" varchar(30),
      "passwordHash" text NOT NULL,
      "createdAt" timestamp NOT NULL DEFAULT now(),
      "updatedAt" timestamp NOT NULL DEFAULT now()
    )
  `;

  await sql`
    ALTER TABLE "userCredentials"
      ADD COLUMN IF NOT EXISTS "username" varchar(100),
      ADD COLUMN IF NOT EXISTS "phone" varchar(30)
  `;

  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS "user_credentials_user_idx"
    ON "userCredentials" ("userId")
  `;

  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS "user_credentials_email_idx"
    ON "userCredentials" ("email")
  `;

  const columns = await sql`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_name = 'userCredentials'
    ORDER BY ordinal_position
  `;

  console.log("userCredentials schema is ready.");
  console.log(JSON.stringify(columns.map((row) => row.column_name)));
} finally {
  await sql.end();
}
