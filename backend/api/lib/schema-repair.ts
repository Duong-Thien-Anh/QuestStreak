import postgres from "postgres";
import { env } from "./env";

function withPublicSearchPath(databaseUrl: string): string {
  const url = new URL(databaseUrl);
  if (!url.searchParams.has("options")) {
    url.searchParams.set("options", "-c search_path=public");
  }
  return url.toString();
}

export async function ensureUserCredentialsSchema() {
  if (!env.databaseUrl) {
    return;
  }

  const sql = postgres(withPublicSearchPath(env.databaseUrl), { max: 1 });
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS public."userCredentials" (
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
      ALTER TABLE public."userCredentials"
        ADD COLUMN IF NOT EXISTS "username" varchar(100),
        ADD COLUMN IF NOT EXISTS "phone" varchar(30)
    `;

    await sql`
      CREATE UNIQUE INDEX IF NOT EXISTS "user_credentials_user_idx"
      ON public."userCredentials" ("userId")
    `;

    await sql`
      CREATE UNIQUE INDEX IF NOT EXISTS "user_credentials_email_idx"
      ON public."userCredentials" ("email")
    `;
  } finally {
    await sql.end();
  }
}
