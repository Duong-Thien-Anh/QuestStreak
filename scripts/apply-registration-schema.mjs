// Run: node --env-file=.env scripts/apply-registration-schema.mjs
import { resolveDatabaseUrl } from "./_db-url.mjs";
import postgres from "postgres";

const sql = postgres(resolveDatabaseUrl());

await sql.begin(async (tx) => {
  // Add username/phone to userCredentials
  await tx`
    ALTER TABLE "userCredentials"
      ADD COLUMN IF NOT EXISTS "username" varchar(100),
      ADD COLUMN IF NOT EXISTS "phone" varchar(30)
  `;

  // Create registrationStatus enum
  await tx`DO $$ BEGIN
    CREATE TYPE "registrationStatus" AS ENUM ('pending','approved','rejected');
  EXCEPTION WHEN duplicate_object THEN NULL; END $$`;

  // Create registrationRequests table
  await tx`
    CREATE TABLE IF NOT EXISTS "registrationRequests" (
      "id"              serial PRIMARY KEY,
      "name"            varchar(255) NOT NULL,
      "email"           varchar(320) NOT NULL,
      "username"        varchar(100),
      "phone"           varchar(30),
      "lifestyleRole"   "lifestyleRole" NOT NULL DEFAULT 'submissive',
      "gender"          "gender" NOT NULL DEFAULT 'female',
      "passwordHash"    text NOT NULL,
      "status"          "registrationStatus" NOT NULL DEFAULT 'pending',
      "rejectionReason" text,
      "reviewedBy"      bigint,
      "reviewedAt"      timestamp,
      "createdAt"       timestamp NOT NULL DEFAULT now(),
      "updatedAt"       timestamp NOT NULL DEFAULT now()
    )
  `;

  await tx`CREATE UNIQUE INDEX IF NOT EXISTS "reg_requests_email_idx" ON "registrationRequests"("email")`;
  await tx`CREATE INDEX IF NOT EXISTS "reg_requests_status_idx" ON "registrationRequests"("status")`;
});

console.log("✓ Registration schema applied");
await sql.end();
