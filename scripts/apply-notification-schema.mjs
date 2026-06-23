import "dotenv/config";
import postgres from "postgres";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is required");
}

const sql = postgres(connectionString);

try {
  await sql`
    DO $$
    BEGIN
      CREATE TYPE "notificationType" AS ENUM (
        'task_created',
        'task_assigned',
        'task_submitted',
        'task_completed',
        'task_rejected',
        'achievement_unlocked',
        'wallet_updated',
        'system'
      );
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS "notifications" (
      "id" serial PRIMARY KEY NOT NULL,
      "houseId" bigint NOT NULL,
      "recipientId" bigint,
      "actorId" bigint,
      "type" "notificationType" DEFAULT 'system' NOT NULL,
      "title" varchar(255) NOT NULL,
      "message" text,
      "entityType" varchar(50),
      "entityId" bigint,
      "metadata" text,
      "readAt" timestamp,
      "createdAt" timestamp DEFAULT now() NOT NULL
    );
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS "notifications_house_created_idx"
    ON "notifications" ("houseId", "createdAt");
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS "notifications_recipient_read_idx"
    ON "notifications" ("recipientId", "readAt");
  `;

  console.log("Notification schema applied.");
} finally {
  await sql.end();
}
