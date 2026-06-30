import { resolveDatabaseUrl } from "./_db-url.mjs";
import postgres from "postgres";

const sql = postgres(resolveDatabaseUrl(), { max: 1 });

try {
  await sql`
    CREATE TABLE IF NOT EXISTS "roomCodes" (
      "id" serial PRIMARY KEY,
      "houseId" bigint NOT NULL,
      "code" varchar(32) NOT NULL,
      "approvalRequired" boolean DEFAULT false NOT NULL,
      "createdAt" timestamp DEFAULT now() NOT NULL,
      "updatedAt" timestamp DEFAULT now() NOT NULL
    )
  `;

  await sql`
    ALTER TABLE "roomCodes"
    ADD COLUMN IF NOT EXISTS "approvalRequired" boolean DEFAULT false NOT NULL
  `;

  await sql`
    INSERT INTO "roomCodes" ("houseId", "code")
    SELECT
      h."id",
      upper(substring(md5(random()::text || clock_timestamp()::text || h."id"::text), 1, 10))
    FROM "houses" h
    LEFT JOIN "roomCodes" rc ON rc."houseId" = h."id"
    WHERE rc."id" IS NULL
  `;

  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS "room_codes_house_idx"
    ON "roomCodes" ("houseId")
  `;

  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS "room_codes_code_idx"
    ON "roomCodes" ("code")
  `;

  await sql`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'joinRequestStatus') THEN
        CREATE TYPE "joinRequestStatus" AS ENUM ('pending', 'approved', 'rejected');
      END IF;
    END
    $$;
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS "roomJoinRequests" (
      "id" serial PRIMARY KEY,
      "houseId" bigint NOT NULL,
      "userId" bigint NOT NULL,
      "nickname" varchar(255),
      "gender" "gender" DEFAULT 'female' NOT NULL,
      "status" "joinRequestStatus" DEFAULT 'pending' NOT NULL,
      "reviewedBy" bigint,
      "reviewedAt" timestamp,
      "createdAt" timestamp DEFAULT now() NOT NULL,
      "updatedAt" timestamp DEFAULT now() NOT NULL
    )
  `;

  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS "room_join_requests_house_user_idx"
    ON "roomJoinRequests" ("houseId", "userId")
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS "room_join_requests_house_status_idx"
    ON "roomJoinRequests" ("houseId", "status")
  `;

  console.log("Room code and join approval schema applied");
} finally {
  await sql.end();
}
