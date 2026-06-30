import { resolveDatabaseUrl } from "./_db-url.mjs";
import postgres from "postgres";

const sql = postgres(resolveDatabaseUrl());

try {
  await sql`
    DO $$
    BEGIN
      CREATE TYPE "inviteStatus" AS ENUM ('active', 'accepted', 'revoked', 'expired');
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS "houseInvites" (
      "id" serial PRIMARY KEY NOT NULL,
      "houseId" bigint NOT NULL,
      "code" varchar(32) NOT NULL,
      "invitedBy" bigint NOT NULL,
      "intendedNickname" varchar(255),
      "lifestyleRole" "lifestyleRole" DEFAULT 'submissive' NOT NULL,
      "gender" "gender" DEFAULT 'female' NOT NULL,
      "status" "inviteStatus" DEFAULT 'active' NOT NULL,
      "expiresAt" timestamp,
      "acceptedBy" bigint,
      "acceptedAt" timestamp,
      "createdAt" timestamp DEFAULT now() NOT NULL,
      "updatedAt" timestamp DEFAULT now() NOT NULL
    );
  `;

  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS "house_invites_code_idx"
    ON "houseInvites" ("code");
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS "house_invites_house_status_idx"
    ON "houseInvites" ("houseId", "status");
  `;

  console.log("Invite schema applied.");
} finally {
  await sql.end();
}
